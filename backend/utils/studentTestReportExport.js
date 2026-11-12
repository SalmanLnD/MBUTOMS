import StudentMonthlyTestReport from '../models/StudentMonthlyTestReport.js';
import Student from '../models/Student.js';
import Schedule from '../models/Schedule.js';
import '../models/Subject.js';
import {
  getMonthLabelFromKey,
  getReportMonthKeys,
} from './studentTestReportDates.js';
import {
  DEFAULT_MAX_MARKS,
  PASS_PERCENTAGE,
  accumulateReportStats,
  computePercentage,
  createEmptyStats,
  finalizeStats,
  formatPassStatus,
  resolveAttendance,
} from './studentTestReportConstants.js';

const MARKS_HEADERS = [
  'Month',
  'Subject',
  'Subject Code',
  'Department',
  'Section',
  'Semester',
  'PY',
  'Roll No.',
  'Student Name',
  'P/A',
  'Marks',
  'Out of',
  'Percentage',
  'Result',
];

const MONTH_MARKS_HEADERS = MARKS_HEADERS.filter((header) => header !== 'Month');

const STUDENT_SUMMARY_MONTHS = ['2026-08', '2026-09', '2026-10'];
const hasAssessmentResults = (reports) => reports.some(
  (report) => Number.isFinite(report.marksObtained) || resolveAttendance(report) === 'A'
);

// One row per student and subject; zero is a mark, missing/ungraded is NA.
export const buildStudentSummaryRows = (students, schedules, reports, monthKeys = STUDENT_SUMMARY_MONTHS) => {
  const classKey = (department, section, semester) => [department, section, semester].join('|');
  const subjectsByClass = new Map();
  for (const schedule of schedules) {
    const subject = schedule.subject;
    if (!subject?._id) continue;
    const key = classKey(schedule.department, schedule.section, schedule.semester);
    if (!subjectsByClass.has(key)) subjectsByClass.set(key, new Map());
    subjectsByClass.get(key).set(String(subject._id), subject);
  }
  const reportsByStudentSubject = new Map();
  const historicalSubjectsByStudent = new Map();
  for (const report of reports) {
    const studentId = String(report.student?._id || report.student || '');
    const subjectId = String(report.subject?._id || report.subject || '');
    const key = `${studentId}|${subjectId}`;
    if (!reportsByStudentSubject.has(key)) reportsByStudentSubject.set(key, new Map());
    reportsByStudentSubject.get(key).set(report.month, report);
    if (!historicalSubjectsByStudent.has(studentId)) historicalSubjectsByStudent.set(studentId, new Map());
    historicalSubjectsByStudent.get(studentId).set(subjectId, {
      _id: subjectId,
      name: report.subjectName || report.subject?.name || '',
      code: report.subjectCode || report.subject?.code || '',
    });
  }
  const rows = [];
  for (const student of students) {
    const subjects = new Map(subjectsByClass.get(classKey(student.branch, student.sectionLabel, student.semesterLabel)) || []);
    for (const [id, subject] of historicalSubjectsByStudent.get(String(student._id)) || []) {
      if (!subjects.has(id)) subjects.set(id, subject);
    }
    for (const [subjectId, subject] of subjects) {
      const monthly = reportsByStudentSubject.get(`${student._id}|${subjectId}`) || new Map();
      const values = monthKeys.map((month) => {
        const report = monthly.get(month);
        if (!report) return 'NA';
        if (resolveAttendance(report) === 'A') return 'Absent';
        return Number.isFinite(report.marksObtained) ? report.marksObtained : 'NA';
      });
      const average = values.length && values.every((value) => typeof value === 'number')
        ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
        : 'Not finalized';
      rows.push([student.rollNumber || '', student.name || '', student.branch || '', student.sectionLabel || '',
        student.semesterLabel || '', subject.name || '', subject.code || '', ...values, average]);
    }
  }
  rows.sort((a, b) => String(a[2]).localeCompare(String(b[2])) || String(a[3]).localeCompare(String(b[3]), undefined, { numeric: true })
    || String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }) || String(a[6]).localeCompare(String(b[6])));
  return [['Roll No.', 'Student Name', 'Department', 'Section', 'Semester', 'Subject', 'Subject Code',
    ...monthKeys.map(getMonthLabelFromKey), 'Average'], ...rows];
};

const SUBJECT_SUMMARY_HEADERS = [
  'Month',
  'Subject',
  'Subject Code',
  'Present (graded)',
  'Passed',
  'Failed',
  'Absent',
  'Pass %',
  'Pass Threshold %',
];

const CLASS_SUMMARY_HEADERS = [
  'Month',
  'Department',
  'Section',
  'Semester',
  'Subject',
  'Subject Code',
  'Present (graded)',
  'Passed',
  'Failed',
  'Absent',
  'Pass %',
  'Pass Threshold %',
];

export const buildSubjectSummaryRows = (reports) => {
  const bySubject = new Map();

  reports.forEach((report) => {
    const subjectKey = String(report.subject || report.subjectCode || 'unknown');
    if (!bySubject.has(subjectKey)) {
      bySubject.set(subjectKey, {
        subjectName: report.subjectName || report.subject?.name || 'Unknown',
        subjectCode: report.subjectCode || report.subject?.code || '',
        ...createEmptyStats(),
      });
    }
    accumulateReportStats(bySubject.get(subjectKey), report);
  });

  return [...bySubject.values()]
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName))
    .map(finalizeStats);
};

export const buildClassSubjectSummaryRows = (reports) => {
  const byClassSubject = new Map();

  reports.forEach((report) => {
    const key = [
      report.department,
      report.section,
      report.semester,
      report.subject || report.subjectCode,
    ].join('|');
    if (!byClassSubject.has(key)) {
      byClassSubject.set(key, {
        department: report.department,
        section: report.section,
        semester: report.semester,
        subjectName: report.subjectName || report.subject?.name || 'Unknown',
        subjectCode: report.subjectCode || report.subject?.code || '',
        ...createEmptyStats(),
      });
    }
    accumulateReportStats(byClassSubject.get(key), report);
  });

  return [...byClassSubject.values()]
    .sort((a, b) =>
      a.department.localeCompare(b.department)
      || a.section.localeCompare(b.section, undefined, { numeric: true })
      || a.semester.localeCompare(b.semester)
      || a.subjectName.localeCompare(b.subjectName))
    .map(finalizeStats);
};

const formatSummaryRow = (monthLabel, row, classFields = []) => [
  monthLabel,
  ...classFields,
  row.subjectName,
  row.subjectCode,
  row.entered,
  row.passed,
  row.failed,
  row.absent,
  row.passPercentage != null ? `${row.passPercentage}%` : '—',
  `${PASS_PERCENTAGE}%`,
];

const mapReportToMarksRow = (report, { includeMonth = true, monthLabel = '' } = {}) => {
  const maxMarks = report.maxMarks ?? DEFAULT_MAX_MARKS;
  const attendance = resolveAttendance(report);
  const pct = computePercentage(report.marksObtained, maxMarks);
  const row = [
    report.subjectName || report.subject?.name || '',
    report.subjectCode || report.subject?.code || '',
    report.department,
    report.section,
    report.semester,
    report.py || report.student?.py || '',
    report.student?.rollNumber || '',
    report.student?.name || '',
    attendance,
    attendance === 'A' ? '' : (report.marksObtained ?? ''),
    maxMarks,
    attendance === 'A' || pct == null ? '' : `${pct}%`,
    formatPassStatus(report.marksObtained, maxMarks, report),
  ];
  return includeMonth ? [monthLabel, ...row] : row;
};

const buildMarksSheetRows = (reports, monthLabel, { includeMonth = true } = {}) => {
  const headers = includeMonth ? MARKS_HEADERS : MONTH_MARKS_HEADERS;
  return [
    headers,
    ...reports.map((report) => mapReportToMarksRow(report, { includeMonth, monthLabel })),
  ];
};

const buildSummarySheetRows = (monthSummaries) => {
  const summaryRows = [
    ['Subject-wise summary'],
    SUBJECT_SUMMARY_HEADERS,
  ];

  monthSummaries.forEach(({ monthLabel, subjectSummary }) => {
    summaryRows.push(
      ...subjectSummary.map((row) => formatSummaryRow(monthLabel, row))
    );
  });

  summaryRows.push([]);
  summaryRows.push(['Class-wise summary']);
  summaryRows.push(CLASS_SUMMARY_HEADERS);

  monthSummaries.forEach(({ monthLabel, classSummary }) => {
    summaryRows.push(
      ...classSummary.map((row) => formatSummaryRow(monthLabel, row, [
        row.department,
        row.section,
        row.semester,
      ]))
    );
  });

  return summaryRows;
};

const loadReports = (filter = {}) =>
  StudentMonthlyTestReport.find(filter)
    .populate('student', 'rollNumber name py')
    .populate('subject', 'name code')
    .sort({ month: 1, subjectName: 1, department: 1, section: 1, semester: 1 })
    .lean();

export const buildTestReportExportPayload = async (month, { reportFilter = {} } = {}) => {
  const savedReports = await loadReports({ month, ...reportFilter });
  const reports = hasAssessmentResults(savedReports) ? savedReports : [];
  const monthLabel = getMonthLabelFromKey(month);
  const subjectSummary = buildSubjectSummaryRows(reports);
  const classSummary = buildClassSubjectSummaryRows(reports);

  const summarySheetRows = buildSummarySheetRows([{
    monthLabel,
    subjectSummary,
    classSummary,
  }]);

  return {
    month,
    monthLabel,
    passThreshold: PASS_PERCENTAGE,
    defaultMaxMarks: DEFAULT_MAX_MARKS,
    summarySheetName: 'Summary',
    summaryRows: summarySheetRows,
    marksRows: buildMarksSheetRows(reports, monthLabel),
    subjects: subjectSummary,
    classes: classSummary,
  };
};

export const buildTestReportSheetsExportPayload = async () => {
  const monthKeys = getReportMonthKeys();
  const [allReports, students, schedules] = await Promise.all([
    loadReports({ month: { $in: monthKeys } }),
    Student.find({ status: 'active' }).select('rollNumber name branch sectionLabel semesterLabel').lean(),
    Schedule.find({ subject: { $ne: null } }).select('department section semester subject').populate('subject', 'name code').lean(),
  ]);
  const reportsByMonth = new Map(monthKeys.map((monthKey) => [monthKey, []]));

  allReports.forEach((report) => {
    const bucket = reportsByMonth.get(report.month);
    if (bucket) bucket.push(report);
  });

  const assessedMonthKeys = monthKeys.filter((monthKey) => hasAssessmentResults(reportsByMonth.get(monthKey)));
  const monthSummaries = assessedMonthKeys.map((monthKey) => {
    const reports = reportsByMonth.get(monthKey);
    const monthLabel = getMonthLabelFromKey(monthKey);
    return {
      month: monthKey,
      monthLabel,
      subjectSummary: buildSubjectSummaryRows(reports),
      classSummary: buildClassSubjectSummaryRows(reports),
      reports,
    };
  });

  const monthSheets = monthSummaries.map(({ month, monthLabel, reports }) => ({
    month,
    sheetName: monthLabel,
    rows: buildMarksSheetRows(reports, monthLabel, { includeMonth: false }),
  }));

  return {
    passThreshold: PASS_PERCENTAGE,
    defaultMaxMarks: DEFAULT_MAX_MARKS,
    summarySheetName: 'Summary',
    summaryRows: buildSummarySheetRows(monthSummaries),
    studentSummarySheetName: 'Student Summary',
    studentSummaryRows: buildStudentSummaryRows(students, schedules, monthSummaries.flatMap(({ reports }) => reports), assessedMonthKeys),
    monthSheets,
    managedSheetNames: ['Summary', 'Student Summary', ...monthSheets.map((sheet) => sheet.sheetName)],
  };
};

export const getAccessibleReportFilter = async (user, helpers) => {
  if (helpers.canViewAll(user)) return {};
  if (!user?.trainer) return { _id: null };

  const classKeys = await helpers.getTrainerClassKeys(user.trainer);
  if (!classKeys.size) return { _id: null };

  const orClauses = [...classKeys].map((key) => {
    const [department, section, semester] = key.split('|');
    return { department, section, semester };
  });
  return { $or: orClauses };
};
