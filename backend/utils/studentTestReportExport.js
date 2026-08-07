import StudentMonthlyTestReport from '../models/StudentMonthlyTestReport.js';
import { formatMonthLabel } from './studentTestReportDates.js';
import {
  DEFAULT_MAX_MARKS,
  PASS_PERCENTAGE,
  computePercentage,
  formatPassStatus,
  isPassingMark,
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
  'Marks',
  'Out of',
  'Percentage',
  'Result',
  'Remarks',
];

const SUMMARY_HEADERS = [
  'Month',
  'Subject',
  'Subject Code',
  'Students Entered',
  'Passed',
  'Failed',
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
        entered: 0,
        passed: 0,
        failed: 0,
      });
    }
    const bucket = bySubject.get(subjectKey);
    if (report.marksObtained == null) return;
    bucket.entered += 1;
    if (isPassingMark(report.marksObtained, report.maxMarks || DEFAULT_MAX_MARKS)) {
      bucket.passed += 1;
    } else {
      bucket.failed += 1;
    }
  });

  return [...bySubject.values()]
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName))
    .map((row) => ({
      ...row,
      passPercentage: row.entered
        ? Math.round((row.passed / row.entered) * 1000) / 10
        : null,
    }));
};

export const buildTestReportExportPayload = async (month, { reportFilter = {} } = {}) => {
  const reports = await StudentMonthlyTestReport.find({ month, ...reportFilter })
    .populate('student', 'rollNumber name py')
    .populate('subject', 'name code')
    .sort({ subjectName: 1, department: 1, section: 1, semester: 1 })
    .lean();

  const monthLabel = formatMonthLabel(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7))
  );

  const summaryRows = buildSubjectSummaryRows(reports);
  const summarySheetRows = [
    SUMMARY_HEADERS,
    ...summaryRows.map((row) => [
      monthLabel,
      row.subjectName,
      row.subjectCode,
      row.entered,
      row.passed,
      row.failed,
      row.passPercentage != null ? `${row.passPercentage}%` : '—',
      `${PASS_PERCENTAGE}%`,
    ]),
  ];

  const marksSheetRows = [
    MARKS_HEADERS,
    ...reports.map((report) => {
      const maxMarks = report.maxMarks ?? DEFAULT_MAX_MARKS;
      const pct = computePercentage(report.marksObtained, maxMarks);
      return [
        monthLabel,
        report.subjectName || report.subject?.name || '',
        report.subjectCode || report.subject?.code || '',
        report.department,
        report.section,
        report.semester,
        report.py || report.student?.py || '',
        report.student?.rollNumber || '',
        report.student?.name || '',
        report.marksObtained ?? '',
        maxMarks,
        pct != null ? `${pct}%` : '',
        formatPassStatus(report.marksObtained, maxMarks),
        report.remarks || '',
      ];
    }),
  ];

  return {
    month,
    monthLabel,
    passThreshold: PASS_PERCENTAGE,
    defaultMaxMarks: DEFAULT_MAX_MARKS,
    summarySheetName: 'Summary',
    marksSheetName: 'Monthly Test Marks',
    summaryRows: summarySheetRows,
    marksRows: marksSheetRows,
    summary: summaryRows,
  };
};

export const buildTestReportExcelSheets = async (month, options = {}) => {
  const payload = await buildTestReportExportPayload(month, options);
  return {
    summary: payload.summaryRows,
    marks: payload.marksRows,
    monthLabel: payload.monthLabel,
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
