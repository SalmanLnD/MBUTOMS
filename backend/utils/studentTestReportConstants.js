export const DEFAULT_MAX_MARKS = 10;
export const PASS_PERCENTAGE = 50;

export const computePercentage = (marksObtained, maxMarks) => {
  if (marksObtained == null || !maxMarks) return null;
  return Math.round((marksObtained / maxMarks) * 1000) / 10;
};

export const isPassingMark = (marksObtained, maxMarks) => {
  const pct = computePercentage(marksObtained, maxMarks);
  return pct != null && pct >= PASS_PERCENTAGE;
};

export const formatPassStatus = (marksObtained, maxMarks) => {
  if (marksObtained == null) return 'Pending';
  return isPassingMark(marksObtained, maxMarks) ? 'Pass' : 'Fail';
};
