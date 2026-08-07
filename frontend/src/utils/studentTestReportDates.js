export const STUDENT_TEST_REPORT_TRACKING_START = '2026-08-01';

export const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

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

export const shiftMonth = ({ year, month }, delta) => {
  const date = new Date(year, month - 1 + delta, 1);
  return clampMonthParts({ year: date.getFullYear(), month: date.getMonth() + 1 });
};

export const formatMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const buildMonthOptions = () => {
  const tracking = getTrackingStartParts();
  const latest = getCurrentMonthParts();
  const options = [];
  let { year, month } = tracking;

  while (year < latest.year || (year === latest.year && month <= latest.month)) {
    options.push({
      value: formatMonthKey(year, month),
      label: formatMonthLabel(year, month),
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return options;
};
