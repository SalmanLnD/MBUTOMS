export const STUDENT_TEST_REPORT_TRACKING_START = '2026-08-01';

export const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

export const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const getTrackingStartParts = () =>
  parseMonthKey(STUDENT_TEST_REPORT_TRACKING_START.slice(0, 7));

export const getCurrentMonthParts = (referenceDate = new Date()) => {
  const ref = new Date(referenceDate);
  return { year: ref.getFullYear(), month: ref.getMonth() + 1 };
};

export const clampMonthParts = ({ year, month }) => {
  const tracking = getTrackingStartParts();
  const trackingIndex = tracking.year * 12 + tracking.month - 1;
  const latest = getCurrentMonthParts();
  const latestIndex = latest.year * 12 + latest.month - 1;
  let index = year * 12 + month - 1;
  if (index < trackingIndex) index = trackingIndex;
  if (index > latestIndex) index = latestIndex;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const isValidReportMonth = (monthKey) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey || '')) return false;
  const tracking = getTrackingStartParts();
  const { year, month } = parseMonthKey(monthKey);
  const monthIndex = year * 12 + month - 1;
  const trackingIndex = tracking.year * 12 + tracking.month - 1;
  const latest = getCurrentMonthParts();
  const latestIndex = latest.year * 12 + latest.month - 1;
  return monthIndex >= trackingIndex && monthIndex <= latestIndex;
};
