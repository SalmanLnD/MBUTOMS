import StudentMonthlyTestReport from '../models/StudentMonthlyTestReport.js';
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
  const reports = await loadReports({ month, ...reportFilter });
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
  const allReports = await loadReports({ month: { $in: monthKeys } });
  const reportsByMonth = new Map(monthKeys.map((monthKey) => [monthKey, []]));

  allReports.forEach((report) => {
    const bucket = reportsByMonth.get(report.month);
    if (bucket) bucket.push(report);
  });

  const monthSummaries = monthKeys.map((monthKey) => {
    const reports = reportsByMonth.get(monthKey) || [];
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
    monthSheets,
    managedSheetNames: ['Summary', ...monthSheets.map((sheet) => sheet.sheetName)],
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
