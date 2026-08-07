import ExcelJS from 'exceljs';
import Student from '../models/Student.js';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import ClassGroup from '../models/ClassGroup.js';
import StudentMonthlyTestReport from '../models/StudentMonthlyTestReport.js';
import { FULL_ACCESS_ROLES, isAuthorizedRole } from '../utils/roles.js';
import { isValidReportMonth, formatMonthLabel } from '../utils/studentTestReportDates.js';
import {
  DEFAULT_MAX_MARKS,
  PASS_PERCENTAGE,
  computePercentage,
  formatPassStatus,
} from '../utils/studentTestReportConstants.js';
import {
  buildSubjectSummaryRows,
  buildTestReportExportPayload,
  getAccessibleReportFilter,
} from '../utils/studentTestReportExport.js';

const MANAGEMENT_ROLES = [...FULL_ACCESS_ROLES, 'subject_coordinator'];

const canViewAll = (user) => isAuthorizedRole(user?.role, MANAGEMENT_ROLES);

const getTrainerScheduleCodes = async (trainerId) => {
  if (!trainerId) return [];
  const trainer = await Trainer.findById(trainerId)
    .select('employeeId scheduleTrainerCodes')
    .lean();
  if (!trainer) return [];
  const codes = new Set([trainer.employeeId, ...(trainer.scheduleTrainerCodes || [])]);
  return [...codes].filter(Boolean);
};

const getTrainerClassKeys = async (trainerId) => {
  const codes = await getTrainerScheduleCodes(trainerId);
  if (!codes.length) return new Set();

  const schedules = await Schedule.find({ trainerCode: { $in: codes } })
    .select('department section semester')
    .lean();

  return new Set(
    schedules.map((s) => `${s.department}|${s.section}|${s.semester}`)
  );
};

const classKey = (department, section, semester) =>
  `${department}|${section}|${semester}`;

const canAccessClass = async (user, department, section, semester) => {
  if (canViewAll(user)) return true;
  if (!user?.trainer) return false;
  const allowed = await getTrainerClassKeys(user.trainer);
  return allowed.has(classKey(department, section, semester));
};

const getTrainerSubjectIdsForClass = async (trainerId, department, section, semester) => {
  const codes = await getTrainerScheduleCodes(trainerId);
  if (!codes.length) return new Set();

  const schedules = await Schedule.find({
    trainerCode: { $in: codes },
    department,
    section,
    semester,
  }).select('subject').lean();

  return new Set(
    schedules.map((s) => String(s.subject)).filter(Boolean)
  );
};

const canAccessSubject = async (user, subjectId, department, section, semester) => {
  if (canViewAll(user)) return true;
  if (!user?.trainer || !subjectId) return false;
  const allowed = await getTrainerSubjectIdsForClass(
    user.trainer,
    department,
    section,
    semester
  );
  return allowed.has(String(subjectId));
};

const accessHelpers = {
  canViewAll,
  getTrainerClassKeys,
};

export const getTestReportFilterOptions = async (req, res) => {
  const classes = await ClassGroup.find({ status: 'active' })
    .sort({ department: 1, section: 1, py: 1 })
    .lean();

  let filtered = classes;
  if (!canViewAll(req.user) && req.user?.trainer) {
    const allowed = await getTrainerClassKeys(req.user.trainer);
    filtered = classes.filter((cls) =>
      allowed.has(classKey(cls.department, cls.section, cls.currentSemester))
    );
  }

  res.json(filtered.map((cls) => ({
    _id: cls._id,
    department: cls.department,
    section: cls.section,
    py: cls.py,
    currentSemester: cls.currentSemester,
    label: `${cls.department} ${cls.section}`,
  })));
};

export const getTestReportSubjects = async (req, res) => {
  const { department, section, semester } = req.query;
  if (!department || !section || !semester) {
    return res.status(400).json({ message: 'department, section, and semester are required' });
  }

  const hasAccess = await canAccessClass(req.user, department, section, semester);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Not authorized to view this class' });
  }

  const schedules = await Schedule.find({ department, section, semester })
    .select('subject subjectCode')
    .populate('subject', 'name code')
    .lean();

  let subjectIds = [...new Set(
    schedules.map((s) => String(s.subject?._id || s.subject)).filter(Boolean)
  )];

  if (!canViewAll(req.user) && req.user?.trainer) {
    const allowedSubjects = await getTrainerSubjectIdsForClass(
      req.user.trainer,
      department,
      section,
      semester
    );
    subjectIds = subjectIds.filter((id) => allowedSubjects.has(id));
  }

  const subjects = await Subject.find({ _id: { $in: subjectIds } })
    .select('name code')
    .sort({ name: 1 })
    .lean();

  res.json(subjects.map((subject) => ({
    _id: subject._id,
    name: subject.name,
    code: subject.code,
    label: `${subject.name} (${subject.code})`,
  })));
};

export const getTestReportSummary = async (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ message: 'month is required' });
  }
  if (!isValidReportMonth(month)) {
    return res.status(400).json({ message: 'Invalid month. Reports start from August 2026.' });
  }

  const reportFilter = await getAccessibleReportFilter(req.user, accessHelpers);
  if (reportFilter._id === null) {
    return res.json({
      month,
      monthLabel: formatMonthLabel(Number(month.slice(0, 4)), Number(month.slice(5, 7))),
      passThreshold: PASS_PERCENTAGE,
      subjects: [],
    });
  }

  const reports = await StudentMonthlyTestReport.find({ month, ...reportFilter })
    .select('subject subjectCode subjectName marksObtained maxMarks')
    .lean();

  res.json({
    month,
    monthLabel: formatMonthLabel(Number(month.slice(0, 4)), Number(month.slice(5, 7))),
    passThreshold: PASS_PERCENTAGE,
    subjects: buildSubjectSummaryRows(reports),
  });
};

export const getTestReportGrid = async (req, res) => {
  const { month, department, section, semester, py, subject } = req.query;

  if (!month || !department || !section || !semester || !subject) {
    return res.status(400).json({
      message: 'month, department, section, semester, and subject are required',
    });
  }
  if (!isValidReportMonth(month)) {
    return res.status(400).json({ message: 'Invalid month. Reports start from August 2026.' });
  }

  const hasAccess = await canAccessClass(req.user, department, section, semester);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Not authorized to view this class' });
  }

  const hasSubjectAccess = await canAccessSubject(
    req.user,
    subject,
    department,
    section,
    semester
  );
  if (!hasSubjectAccess) {
    return res.status(403).json({ message: 'Not authorized to view this subject' });
  }

  const subjectDoc = await Subject.findById(subject).select('name code').lean();
  if (!subjectDoc) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const studentFilter = {
    status: 'active',
    branch: department,
    sectionLabel: section,
    semesterLabel: semester,
  };
  if (py) studentFilter.py = Number(py);

  const [students, reports] = await Promise.all([
    Student.find(studentFilter)
      .select('rollNumber name branch sectionLabel py semesterLabel')
      .sort({ rollNumber: 1 })
      .lean(),
    StudentMonthlyTestReport.find({ month, department, section, semester, subject })
      .populate('enteredBy', 'name')
      .lean(),
  ]);

  const reportByStudent = new Map(
    reports.map((r) => [String(r.student), r])
  );

  const studentRows = students.map((s) => {
    const report = reportByStudent.get(String(s._id));
    const maxMarks = report?.maxMarks ?? DEFAULT_MAX_MARKS;
    return {
      _id: s._id,
      rollNumber: s.rollNumber,
      name: s.name,
      py: s.py,
      report: report
        ? {
            _id: report._id,
            marksObtained: report.marksObtained,
            maxMarks,
            percentage: computePercentage(report.marksObtained, maxMarks),
            result: formatPassStatus(report.marksObtained, maxMarks),
            remarks: report.remarks,
            enteredBy: report.enteredBy?.name || null,
            updatedAt: report.updatedAt,
          }
        : null,
    };
  });

  const entered = studentRows.filter((row) => row.report?.marksObtained != null);
  const passed = entered.filter((row) => row.report?.result === 'Pass');

  res.json({
    month,
    passThreshold: PASS_PERCENTAGE,
    defaultMaxMarks: DEFAULT_MAX_MARKS,
    subject: {
      _id: subjectDoc._id,
      name: subjectDoc.name,
      code: subjectDoc.code,
    },
    class: { department, section, semester, py: py ? Number(py) : null },
    classSummary: {
      totalStudents: studentRows.length,
      entered: entered.length,
      passed: passed.length,
      failed: entered.length - passed.length,
      passPercentage: entered.length
        ? Math.round((passed.length / entered.length) * 1000) / 10
        : null,
    },
    students: studentRows,
  });
};

export const bulkUpsertTestReports = async (req, res) => {
  const { month, department, section, semester, py, subject, entries } = req.body;

  if (!month || !department || !section || !semester || !subject || !Array.isArray(entries)) {
    return res.status(400).json({
      message: 'month, department, section, semester, subject, and entries are required',
    });
  }
  if (!isValidReportMonth(month)) {
    return res.status(400).json({ message: 'Invalid month. Reports start from August 2026.' });
  }

  const hasAccess = await canAccessClass(req.user, department, section, semester);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Not authorized to edit this class' });
  }

  const hasSubjectAccess = await canAccessSubject(
    req.user,
    subject,
    department,
    section,
    semester
  );
  if (!hasSubjectAccess) {
    return res.status(403).json({ message: 'Not authorized to edit this subject' });
  }

  const subjectDoc = await Subject.findById(subject).select('name code').lean();
  if (!subjectDoc) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const studentIds = entries.map((e) => e.studentId).filter(Boolean);
  const validStudents = await Student.find({
    _id: { $in: studentIds },
    status: 'active',
    branch: department,
    sectionLabel: section,
    semesterLabel: semester,
  }).select('_id').lean();
  const validIdSet = new Set(validStudents.map((s) => String(s._id)));

  const ops = [];
  let saved = 0;
  let skipped = 0;

  for (const entry of entries) {
    const studentId = entry.studentId;
    if (!validIdSet.has(String(studentId))) {
      skipped += 1;
      continue;
    }

    const marksObtained = entry.marksObtained === '' || entry.marksObtained == null
      ? null
      : Number(entry.marksObtained);
    const maxMarks = Number(entry.maxMarks) || DEFAULT_MAX_MARKS;

    if (marksObtained != null && (marksObtained < 0 || marksObtained > maxMarks)) {
      skipped += 1;
      continue;
    }

    ops.push({
      updateOne: {
        filter: { month, student: studentId, subject },
        update: {
          $set: {
            department,
            section,
            semester,
            py: py ? Number(py) : undefined,
            subjectCode: subjectDoc.code,
            subjectName: subjectDoc.name,
            marksObtained,
            maxMarks,
            remarks: String(entry.remarks || '').trim(),
            enteredBy: req.user._id,
          },
        },
        upsert: true,
      },
    });
    saved += 1;
  }

  if (ops.length) {
    await StudentMonthlyTestReport.bulkWrite(ops);
  }

  res.json({ saved, skipped, message: `Saved ${saved} test report(s)` });
};

export const downloadTestReportExcel = async (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ message: 'month is required' });
  }
  if (!isValidReportMonth(month)) {
    return res.status(400).json({ message: 'Invalid month. Reports start from August 2026.' });
  }

  const reportFilter = await getAccessibleReportFilter(req.user, accessHelpers);

  const { summaryRows, marksRows, monthLabel } = await buildTestReportExportPayload(
    month,
    { reportFilter: reportFilter._id === null ? { _id: { $exists: false } } : reportFilter }
  );

  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRows(summaryRows);
  summarySheet.getRow(1).font = { bold: true };

  const marksSheet = workbook.addWorksheet('Monthly Test Marks');
  marksSheet.addRows(marksRows);
  marksSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `monthly-test-reports-${month}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
};

export const exportTestReportsForSheets = async (req, res) => {
  const month = req.query.month;
  if (!month) {
    return res.status(400).json({ message: 'month query parameter is required' });
  }
  if (!isValidReportMonth(month)) {
    return res.status(400).json({ message: 'Invalid month. Reports start from August 2026.' });
  }

  res.json(await buildTestReportExportPayload(month));
};
