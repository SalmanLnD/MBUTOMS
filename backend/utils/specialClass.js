import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceTracking.js';

export const SPECIAL_CLASS_TYPES = {
  ONE_TIME: 'one_time',
  RECURRING: 'recurring',
};

/** Append to any Schedule `.select()` whose results are filtered by date. */
export const SPECIAL_CLASS_FIELDS = 'isSpecial specialType specialStartDate specialEndDate';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A recurring group completes only when its final scheduled weekday/time ends,
// rather than moving each elapsed occurrence into the completed list.
export const specialClassCompletionTime = (group) => {
  const end = group.endDate || group.startDate;
  if (!end || !group.startDate || !group.endTime) return null;
  const cursor = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return null;
  for (let i = 0; i < 7; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (key < group.startDate) break;
    if (group.specialType !== SPECIAL_CLASS_TYPES.RECURRING || group.days?.includes(WEEKDAYS[cursor.getUTCDay()])) {
      const time = group.endTime.length === 5 ? `${group.endTime}:00` : group.endTime;
      const completedAt = new Date(`${key}T${time}+05:30`);
      return Number.isNaN(completedAt.getTime()) ? null : completedAt;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return null;
};

export const isSpecialSchedule = (schedule) => Boolean(schedule?.isSpecial);

/** Missing or true keeps current RTET behaviour; false is complementary-only. */
export const isIncludedInRtet = (schedule) => {
  if (!isSpecialSchedule(schedule)) return true;
  return schedule.includeInRtet !== false;
};

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
