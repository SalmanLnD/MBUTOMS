/**
 * Trainer daily attendance uses the IST calendar day everywhere (storage, grid, webhook).
 * Dates are stored as UTC midnight for that YYYY-MM-DD in Asia/Kolkata.
 */
export const ATTENDANCE_TIMEZONE = 'Asia/Kolkata';

const operationalDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ATTENDANCE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

export const toAttendanceDateKey = (dateInput) => {
  if (dateInput === null || dateInput === undefined || dateInput === '') return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  // Calendar dates are already canonical; reject impossible dates, don't roll them over.
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return date.toISOString().slice(0, 10) === dateInput ? dateInput : '';
  }
  return operationalDateFormatter.format(date);
};

export const normalizeAttendanceDate = (dateInput) => {
  const key = toAttendanceDateKey(dateInput);
  if (!key) {
    return new Date(NaN);
  }

  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const getAttendanceToday = () => normalizeAttendanceDate(new Date());

export const TRAINER_ATTENDANCE_TRACKING_START = normalizeAttendanceDate('2026-07-01');
