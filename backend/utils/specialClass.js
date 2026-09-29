import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceTracking.js';

export const SPECIAL_CLASS_TYPES = {
  ONE_TIME: 'one_time',
  RECURRING: 'recurring',
};

/** Append to any Schedule `.select()` whose results are filtered by date. */
export const SPECIAL_CLASS_FIELDS = 'isSpecial specialType specialStartDate specialEndDate';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const isSpecialSchedule = (schedule) => Boolean(schedule?.isSpecial);

export const getSpecialDateKeys = (schedule) => ({
  startKey: toAttendanceDateKey(schedule?.specialStartDate),
  endKey: toAttendanceDateKey(schedule?.specialEndDate || schedule?.specialStartDate),
});

/** Regular slots run every week; special slots only inside their own date window. */
export const isSpecialScheduleActiveOnDate = (schedule, dateInput) => {
  if (!isSpecialSchedule(schedule)) return true;
  const dateKey = toAttendanceDateKey(dateInput);
  const { startKey, endKey } = getSpecialDateKeys(schedule);
  if (!dateKey || !startKey || !endKey) return false;
  return dateKey >= startKey && dateKey <= endKey;
};

export const isSpecialScheduleInRange = (schedule, rangeStart, rangeEnd) => {
  if (!isSpecialSchedule(schedule)) return true;
  const fromKey = toAttendanceDateKey(rangeStart);
  const untilKey = toAttendanceDateKey(rangeEnd || rangeStart);
  const { startKey, endKey } = getSpecialDateKeys(schedule);
  if (!fromKey || !untilKey || !startKey || !endKey) return false;
  return startKey <= untilKey && endKey >= fromKey;
};

/** Monday–Sunday week (IST calendar) containing the reference date. */
export const getWeekRangeForDate = (dateInput) => {
  const ref = normalizeAttendanceDate(dateInput);
  if (Number.isNaN(ref.getTime())) return { start: ref, end: ref };
  const offset = (ref.getUTCDay() + 6) % 7;
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - offset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start, end };
};

export const getWeekdayForDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
};

/** Weekdays that actually occur between two calendar dates (inclusive). */
export const getWeekdaysBetween = (startInput, endInput) => {
  const start = normalizeAttendanceDate(startInput);
  const end = normalizeAttendanceDate(endInput);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const days = new Set();
  const cursor = new Date(start);
  while (cursor <= end && days.size < 7) {
    days.add(WEEKDAYS[cursor.getUTCDay()]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...days];
};
