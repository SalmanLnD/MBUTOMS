export const DEFAULT_MAX_MARKS = 10;
export const PASS_PERCENTAGE = 50;

export const computePercentage = (marksObtained, maxMarks) => {
  if (marksObtained === '' || marksObtained == null || !maxMarks) return null;
  const marks = Number(marksObtained);
  const max = Number(maxMarks);
  if (Number.isNaN(marks) || Number.isNaN(max) || !max) return null;
  return Math.round((marks / max) * 1000) / 10;
};

export const formatPassStatus = (marksObtained, maxMarks) => {
  const pct = computePercentage(marksObtained, maxMarks);
  if (pct == null) return 'Pending';
  return pct >= PASS_PERCENTAGE ? 'Pass' : 'Fail';
};
