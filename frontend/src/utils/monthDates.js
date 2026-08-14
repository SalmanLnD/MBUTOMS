export const TRAINER_ATTENDANCE_TRACKING_START = '2026-07-01';
export const TRAINER_ATTENDANCE_INITIAL_END = '2027-01-31';
export const ATTENDANCE_TIMEZONE = 'Asia/Kolkata';

export const toAttendanceDateKey = (dateInput = new Date()) => (
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateInput))
);

export const toInputDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }
  return toAttendanceDateKey(date);
};

export const formatAttendanceDayLabel = (dateInput) => {
  if (!dateInput) return '-';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 6)).toLocaleDateString('en-IN', {
      timeZone: ATTENDANCE_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return new Date(dateInput).toLocaleDateString('en-IN', {
    timeZone: ATTENDANCE_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

export const getTrackingStartParts = () => parseMonthKey(TRAINER_ATTENDANCE_TRACKING_START.slice(0, 7));

export const getCurrentMonthParts = (referenceDate = new Date()) => {
  const [year, month] = toAttendanceDateKey(referenceDate).split('-').map(Number);
  return { year, month };
};

export const getLatestAttendanceMonthParts = (referenceDate = new Date()) => {
  const current = getCurrentMonthParts(referenceDate);
  const configured = parseMonthKey(TRAINER_ATTENDANCE_INITIAL_END.slice(0, 7));
  const currentIndex = current.year * 12 + current.month - 1;
  const configuredIndex = configured.year * 12 + configured.month - 1;
  return currentIndex > configuredIndex ? current : configured;
};

export const clampMonthParts = ({ year, month }) => {
  const tracking = getTrackingStartParts();
  const trackingIndex = tracking.year * 12 + tracking.month - 1;
  const latest = getLatestAttendanceMonthParts();
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
  const latest = getLatestAttendanceMonthParts();
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

export const isFutureDateKey = (dateKey, referenceDate = new Date()) =>
  dateKey > toAttendanceDateKey(referenceDate);
