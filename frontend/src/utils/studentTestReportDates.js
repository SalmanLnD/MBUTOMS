export const STUDENT_TEST_REPORT_TRACKING_START = '2026-08-01';

export const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

export const getTrackingStartParts = (term) =>
  parseMonthKey(String(term?.startDate || STUDENT_TEST_REPORT_TRACKING_START).slice(0, 7));

export const getCurrentMonthParts = (referenceDate = new Date()) => {
  const ref = new Date(referenceDate);
  return { year: ref.getFullYear(), month: ref.getMonth() + 1 };
};

export const getLatestReportMonthParts = (term, referenceDate = new Date()) => {
  const current = getCurrentMonthParts(referenceDate);
  if (!term?.endDate) return current;
  const end = parseMonthKey(String(term.endDate).slice(0, 7));
  return end.year * 12 + end.month < current.year * 12 + current.month ? end : current;
};

export const clampMonthParts = ({ year, month }, term) => {
  const tracking = getTrackingStartParts(term);
  const trackingIndex = tracking.year * 12 + tracking.month - 1;
  const latest = getLatestReportMonthParts(term);
  const latestIndex = latest.year * 12 + latest.month - 1;
  let index = year * 12 + month - 1;
  if (index < trackingIndex) index = trackingIndex;
  if (index > latestIndex) index = latestIndex;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const shiftMonth = ({ year, month }, delta, term) => {
  const date = new Date(year, month - 1 + delta, 1);
  return clampMonthParts({ year: date.getFullYear(), month: date.getMonth() + 1 }, term);
};

export const formatMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const buildMonthOptions = (term, referenceDate) => {
  const tracking = getTrackingStartParts(term);
  const latest = getLatestReportMonthParts(term, referenceDate);
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
