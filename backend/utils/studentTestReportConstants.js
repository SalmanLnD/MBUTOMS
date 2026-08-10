export const DEFAULT_MAX_MARKS = 10;
export const PASS_PERCENTAGE = 50;
export const ATTENDANCE_PRESENT = 'P';
export const ATTENDANCE_ABSENT = 'A';
export const DEFAULT_ATTENDANCE = ATTENDANCE_PRESENT;

const ABSENT_REMARK_VALUES = new Set(['a', 'abs', 'absent']);

export const isLegacyAbsentRemark = (value) =>
  ABSENT_REMARK_VALUES.has(String(value || '').trim().toLowerCase());

export const resolveAttendance = (reportOrValue, legacyRemarks) => {
  if (reportOrValue && typeof reportOrValue === 'object') {
    if (reportOrValue.attendance === ATTENDANCE_ABSENT) return ATTENDANCE_ABSENT;
    if (reportOrValue.attendance === ATTENDANCE_PRESENT) return ATTENDANCE_PRESENT;
    if (isLegacyAbsentRemark(reportOrValue.remarks)) return ATTENDANCE_ABSENT;
    return DEFAULT_ATTENDANCE;
  }

  const value = String(reportOrValue || '').trim().toUpperCase();
  if (value === ATTENDANCE_ABSENT) return ATTENDANCE_ABSENT;
  if (value === ATTENDANCE_PRESENT) return ATTENDANCE_PRESENT;
  if (isLegacyAbsentRemark(legacyRemarks ?? reportOrValue)) return ATTENDANCE_ABSENT;
  return DEFAULT_ATTENDANCE;
};

export const isAbsentReport = (report) =>
  resolveAttendance(report) === ATTENDANCE_ABSENT;

export const computePercentage = (marksObtained, maxMarks) => {
  if (marksObtained == null || !maxMarks) return null;
  return Math.round((marksObtained / maxMarks) * 1000) / 10;
};

export const isPassingMark = (marksObtained, maxMarks) => {
  const pct = computePercentage(marksObtained, maxMarks);
  return pct != null && pct >= PASS_PERCENTAGE;
};

export const formatPassStatus = (marksObtained, maxMarks, reportOrAttendance) => {
  if (isAbsentReport(
    typeof reportOrAttendance === 'object'
      ? reportOrAttendance
      : { attendance: reportOrAttendance }
  )) {
    return 'Absent';
  }
  if (marksObtained == null) return 'Pending';
  return isPassingMark(marksObtained, maxMarks) ? 'Pass' : 'Fail';
};

export const createEmptyStats = () => ({
  entered: 0,
  passed: 0,
  failed: 0,
  absent: 0,
});

export const accumulateReportStats = (bucket, report) => {
  if (isAbsentReport(report)) {
    bucket.absent += 1;
    return;
  }
  if (report.marksObtained == null) return;
  bucket.entered += 1;
  if (isPassingMark(report.marksObtained, report.maxMarks || DEFAULT_MAX_MARKS)) {
    bucket.passed += 1;
  } else {
    bucket.failed += 1;
  }
};

export const finalizeStats = (bucket) => ({
  ...bucket,
  passPercentage: bucket.entered
    ? Math.round((bucket.passed / bucket.entered) * 1000) / 10
    : null,
});
