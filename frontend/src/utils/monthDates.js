export const TRAINER_ATTENDANCE_TRACKING_START = '2026-07-01';

export const toInputDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

export const getTrackingStartParts = () => parseMonthKey(TRAINER_ATTENDANCE_TRACKING_START.slice(0, 7));

export const getCurrentMonthParts = (referenceDate = new Date()) => {
  const ref = new Date(referenceDate);
  return { year: ref.getFullYear(), month: ref.getMonth() + 1 };
};

export const clampMonthParts = ({ year, month }) => {
  const tracking = getTrackingStartParts();
  const trackingIndex = tracking.year * 12 + tracking.month;
  const current = getCurrentMonthParts();
  const currentIndex = current.year * 12 + current.month;
  let index = year * 12 + month;
  if (index < trackingIndex) index = trackingIndex;
  if (index > currentIndex) index = currentIndex;
  return { year: Math.floor(index / 12), month: (index % 12) || 12 };
};

export const shiftMonth = ({ year, month }, delta) => {
  const date = new Date(year, month - 1 + delta, 1);
  return clampMonthParts({ year: date.getFullYear(), month: date.getMonth() + 1 });
};

export const formatMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const buildMonthOptions = () => {
  const tracking = getTrackingStartParts();
  const current = getCurrentMonthParts();
  const options = [];
  let { year, month } = tracking;

  while (year < current.year || (year === current.year && month <= current.month)) {
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

export const isFutureDateKey = (dateKey, referenceDate = new Date()) =>
  dateKey > toInputDate(referenceDate);
