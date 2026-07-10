/**
 * Trainer daily attendance uses the IST calendar day everywhere (storage, grid, webhook).
 * Dates are stored as UTC midnight for that YYYY-MM-DD in Asia/Kolkata.
 */
export const ATTENDANCE_TIMEZONE = 'Asia/Kolkata';

export const toAttendanceDateKey = (dateInput) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateInput));
};

export const normalizeAttendanceDate = (dateInput) => {
  const key = toAttendanceDateKey(dateInput);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const getAttendanceToday = () => normalizeAttendanceDate(new Date());

export const TRAINER_ATTENDANCE_TRACKING_START = normalizeAttendanceDate('2026-07-01');
