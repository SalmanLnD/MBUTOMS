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

export const isAbsent = (attendance) => resolveAttendance(attendance) === ATTENDANCE_ABSENT;

export const computePercentage = (marksObtained, maxMarks, attendance) => {
  if (isAbsent(attendance)) return null;
  if (marksObtained === '' || marksObtained == null || !maxMarks) return null;
  const marks = Number(marksObtained);
  const max = Number(maxMarks);
  if (Number.isNaN(marks) || Number.isNaN(max) || !max) return null;
  return Math.round((marks / max) * 1000) / 10;
};

export const formatPassStatus = (marksObtained, maxMarks, attendance) => {
  if (isAbsent(attendance)) return 'Absent';
  const pct = computePercentage(marksObtained, maxMarks, attendance);
  if (pct == null) return 'Pending';
  return pct >= PASS_PERCENTAGE ? 'Pass' : 'Fail';
};
