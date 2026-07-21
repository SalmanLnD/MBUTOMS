import {
  normalizeAttendanceDate,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from './attendanceTracking.js';

export { toAttendanceDateKey, normalizeAttendanceDate, TRAINER_ATTENDANCE_TRACKING_START };

export const parseAttendanceMonthParam = (monthParam, referenceDate = new Date()) => {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split('-').map(Number);
    return { year, month };
  }
  const key = toAttendanceDateKey(referenceDate);
  const [year, month] = key.split('-').map(Number);
  return { year, month };
};

export const getAttendanceMonthRange = (year, month) => {
  const startDate = normalizeAttendanceDate(new Date(Date.UTC(year, month - 1, 1)));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = normalizeAttendanceDate(
    new Date(Date.UTC(year, month - 1, lastDay))
  );
  return { startDate, endDate };
};

export const clampAttendanceMonthToTrackingStart = ({ year, month }) => {
  const { startDate } = getAttendanceMonthRange(year, month);
  if (startDate < TRAINER_ATTENDANCE_TRACKING_START) {
    const key = toAttendanceDateKey(TRAINER_ATTENDANCE_TRACKING_START);
    const [y, m] = key.split('-').map(Number);
    return { year: y, month: m };
  }
  return { year, month };
};

export const formatAttendanceMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const getAttendanceCalendarDates = (startDate, endDate) => {
  const start = normalizeAttendanceDate(startDate);
  const end = normalizeAttendanceDate(endDate);
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

export const isAttendanceWeekendDate = (date) => {
  const normalized = normalizeAttendanceDate(date);
  const day = normalized.getUTCDay();
  return day === 0 || day === 6;
};

export const isAttendanceSundayDate = (date) => {
  const normalized = normalizeAttendanceDate(date);
  return normalized.getUTCDay() === 0;
};

export const getAttendanceWeekdayName = (date) => {
  const normalized = normalizeAttendanceDate(date);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    normalized.getUTCDay()
  ];
};
