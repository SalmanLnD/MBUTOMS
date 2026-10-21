import ClassCancellation from '../models/ClassCancellation.js';
import { normalizeAttendanceDate } from './attendanceTracking.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';
import {
  getLeaveDateKeysForWeekday,
  toLeaveDateKey,
} from './leaveDateRange.js';
import { isSpecialScheduleActiveOnDate } from './specialClass.js';
import Schedule from '../models/Schedule.js';
import { buildSubjectStartDateMap, isScheduleWithinSubjectDates } from './subjectStartDate.js';
import { getAttendanceCalendarDates } from './attendanceDates.js';
import { SPECIAL_CLASS_FIELDS } from './specialClass.js';

const getScheduleId = (schedule) =>
  schedule?._id?.toString?.() || schedule?.toString?.() || '';

const toHolidayDateKeySet = (holidayDateKeys) => {
  if (!holidayDateKeys) return new Set();
  if (holidayDateKeys instanceof Set) return holidayDateKeys;
  if (holidayDateKeys instanceof Map) return new Set(holidayDateKeys.keys());
  if (Array.isArray(holidayDateKeys)) return new Set(holidayDateKeys);
  return new Set();
};

export const buildCanceledScheduleIdsByDate = (cancellations = []) => {
  const result = new Map();

  cancellations.forEach((cancellation) => {
    const dateKey = toLeaveDateKey(cancellation.date);
    if (!dateKey) return;
    let ids = result.get(dateKey);
    if (!ids) {
      ids = new Set();
      result.set(dateKey, ids);
    }
    (cancellation.schedules || []).forEach((schedule) => {
      const scheduleId = getScheduleId(schedule);
      if (scheduleId) ids.add(scheduleId);
    });
  });

  return result;
};

export const getCancellationMapForRange = async (startDate, endDate, { includeSubjectDates = false } = {}) => {
  const [cancellations, schedules, subjectDates] = await Promise.all([ClassCancellation.find({
    date: {
      $gte: normalizeAttendanceDate(startDate),
      $lte: normalizeAttendanceDate(endDate),
    },
  })
    .select('date schedules')
    .lean(),
    includeSubjectDates ? Schedule.find({}).select(`_id subject subjectCode ${SPECIAL_CLASS_FIELDS}`).lean() : [],
    includeSubjectDates ? buildSubjectStartDateMap() : null,
  ]);

  if (!includeSubjectDates) return buildCanceledScheduleIdsByDate(cancellations);
  return addSubjectDateExclusions(buildCanceledScheduleIdsByDate(cancellations), schedules,
    getAttendanceCalendarDates(startDate, endDate), subjectDates);
};

// The shared exclusion map also suppresses timetable slots outside training dates.
// Nothing is persisted as a cancellation; all leave, RRD and export callers agree.
export const addSubjectDateExclusions = (map, schedules, dates, subjectDates) => {
  for (const date of dates) {
    const key = toLeaveDateKey(date);
    for (const schedule of schedules) {
      if (isScheduleWithinSubjectDates(schedule, date, subjectDates)) continue;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(getScheduleId(schedule));
    }
  }
  return map;
};

/**
 * Client cancellations and company official holidays both mean no class runs —
 * but only holidays also mark trainer attendance as Holiday (handled elsewhere).
 */
export const getLeaveClassExclusionsForRange = async (startDate, endDate) => {
  const start = normalizeAttendanceDate(startDate);
  const end = normalizeAttendanceDate(endDate);
  const [cancellationMap, holidayMap] = await Promise.all([
    getCancellationMapForRange(start, end, { includeSubjectDates: true }),
    loadOfficialHolidayMap(start, end),
  ]);

  return {
    cancellationMap,
    holidayDateKeys: new Set(holidayMap.keys()),
  };
};

export const hasUncancelledClassOnDate = (
  schedules = [],
  dateKey,
  weekdayName,
  canceledScheduleIdsByDate = new Map()
) =>
  schedules.some((schedule) => {
    if (new Date(`${dateKey}T12:00:00Z`).getUTCDay() === 0) return false;
    if (schedule.day !== weekdayName) return false;
    if (!isSpecialScheduleActiveOnDate(schedule, dateKey)) return false;
    const scheduleId = getScheduleId(schedule);
    return Boolean(scheduleId) && !canceledScheduleIdsByDate.get(dateKey)?.has(scheduleId);
  });

export const getUncancelledScheduleDateKeys = (
  leave,
  schedule,
  canceledScheduleIdsByDate = new Map(),
  holidayDateKeys = new Set()
) => {
  const holidays = toHolidayDateKeySet(holidayDateKeys);
  const scheduleId = getScheduleId(schedule);
  return getLeaveDateKeysForWeekday(leave, schedule?.day).filter((dateKey) => {
    if (new Date(`${dateKey}T12:00:00Z`).getUTCDay() === 0) return false;
    if (holidays.has(dateKey)) return false;
    if (!isSpecialScheduleActiveOnDate(schedule, dateKey)) return false;
    return !canceledScheduleIdsByDate.get(dateKey)?.has(scheduleId);
  });
};

export const buildAffectedClassOccurrences = (
  leave,
  schedules = leave?.affectedSchedules || [],
  canceledScheduleIdsByDate = new Map(),
  holidayDateKeys = new Set()
) =>
  schedules.flatMap((schedule) =>
    getUncancelledScheduleDateKeys(
      leave,
      schedule,
      canceledScheduleIdsByDate,
      holidayDateKeys
    ).map((date) => ({ schedule, date }))
  );

export const getEffectiveAffectedSchedules = (
  leave,
  schedules = leave?.affectedSchedules || [],
  canceledScheduleIdsByDate = new Map(),
  holidayDateKeys = new Set()
) =>
  schedules.filter(
    (schedule) =>
      getUncancelledScheduleDateKeys(
        leave,
        schedule,
        canceledScheduleIdsByDate,
        holidayDateKeys
      ).length > 0
  );
