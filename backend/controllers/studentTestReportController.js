import Student from '../models/Student.js';
import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import ClassGroup from '../models/ClassGroup.js';
import StudentMonthlyTestReport from '../models/StudentMonthlyTestReport.js';
import { FULL_ACCESS_ROLES, isAuthorizedRole } from '../utils/roles.js';
import { isValidReportMonth } from '../utils/studentTestReportDates.js';

const MANAGEMENT_ROLES = [...FULL_ACCESS_ROLES, 'subject_coordinator'];

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
  if (isAuthorizedRole(user?.role, MANAGEMENT_ROLES)) return true;
  if (!user?.trainer) return false;
  const allowed = await getTrainerClassKeys(user.trainer);
  return allowed.has(classKey(department, section, semester));
};

export const getTestReportFilterOptions = async (req, res) => {
  const classes = await ClassGroup.find({ status: 'active' })
    .sort({ department: 1, section: 1, py: 1 })
    .lean();

  let filtered = classes;
  if (!isAuthorizedRole(req.user?.role, MANAGEMENT_ROLES) && req.user?.trainer) {
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

export const getTestReportGrid = async (req, res) => {
  const { month, department, section, semester, py } = req.query;

  if (!month || !department || !section || !semester) {
    return res.status(400).json({ message: 'month, department, section, and semester are required' });
  }
  if (!isValidReportMonth(month)) {
    return res.status(400).json({ message: 'Invalid month. Reports start from August 2026.' });
  }

  const hasAccess = await canAccessClass(req.user, department, section, semester);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Not authorized to view this class' });
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
    StudentMonthlyTestReport.find({ month, department, section, semester })
      .populate('enteredBy', 'name')
      .lean(),
  ]);

  const reportByStudent = new Map(
    reports.map((r) => [String(r.student), r])
  );

  res.json({
    month,
    class: { department, section, semester, py: py ? Number(py) : null },
    students: students.map((s) => {
      const report = reportByStudent.get(String(s._id));
      return {
        _id: s._id,
        rollNumber: s.rollNumber,
        name: s.name,
        py: s.py,
        report: report
          ? {
              _id: report._id,
              marksObtained: report.marksObtained,
              maxMarks: report.maxMarks,
              remarks: report.remarks,
              enteredBy: report.enteredBy?.name || null,
              updatedAt: report.updatedAt,
            }
          : null,
      };
    }),
  });
};

export const bulkUpsertTestReports = async (req, res) => {
  const { month, department, section, semester, py, entries } = req.body;

  if (!month || !department || !section || !semester || !Array.isArray(entries)) {
    return res.status(400).json({
      message: 'month, department, section, semester, and entries are required',
    });
  }
  if (!isValidReportMonth(month)) {
    return res.status(400).json({ message: 'Invalid month. Reports start from August 2026.' });
  }

  const hasAccess = await canAccessClass(req.user, department, section, semester);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Not authorized to edit this class' });
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
    const maxMarks = Number(entry.maxMarks) || 100;

    if (marksObtained != null && (marksObtained < 0 || marksObtained > maxMarks)) {
      skipped += 1;
      continue;
    }

    ops.push({
      updateOne: {
        filter: { month, student: studentId },
        update: {
          $set: {
            department,
            section,
            semester,
            py: py ? Number(py) : undefined,
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
