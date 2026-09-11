/**
 * Trainer daily attendance uses the IST calendar day everywhere (storage, grid, webhook).
 * Dates are stored as UTC midnight for that YYYY-MM-DD in Asia/Kolkata.
 */
export const ATTENDANCE_TIMEZONE = 'Asia/Kolkata';

// Reused across calls: report builders convert tens of thousands of dates per
// request, and a per-call formatter costs both CPU and retained ICU memory.
const attendanceDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ATTENDANCE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const toAttendanceDateKey = (dateInput) => {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return '';
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return attendanceDateFormatter.format(date);
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
