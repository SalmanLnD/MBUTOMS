import ClassCancellation from '../models/ClassCancellation.js';
import { normalizeAttendanceDate } from './attendanceTracking.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';
import {
  getLeaveDateKeysForWeekday,
  toLeaveDateKey,
} from './leaveDateRange.js';

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

export const getCancellationMapForRange = async (startDate, endDate) => {
  const cancellations = await ClassCancellation.find({
    date: {
      $gte: normalizeAttendanceDate(startDate),
      $lte: normalizeAttendanceDate(endDate),
    },
  })
    .select('date schedules')
    .lean();

  return buildCanceledScheduleIdsByDate(cancellations);
};

/**
 * Client cancellations and company official holidays both mean no class runs —
 * but only holidays also mark trainer attendance as Holiday (handled elsewhere).
 */
export const getLeaveClassExclusionsForRange = async (startDate, endDate) => {
  const start = normalizeAttendanceDate(startDate);
  const end = normalizeAttendanceDate(endDate);
  const [cancellationMap, holidayMap] = await Promise.all([
    getCancellationMapForRange(start, end),
    loadOfficialHolidayMap(start, end),
  ]);

  return {
    cancellationMap,
    holidayDateKeys: new Set(holidayMap.keys()),
  };
};

export const getUncancelledScheduleDateKeys = (
  leave,
  schedule,
  canceledScheduleIdsByDate = new Map(),
  holidayDateKeys = new Set()
) => {
  const holidays = toHolidayDateKeySet(holidayDateKeys);
  const scheduleId = getScheduleId(schedule);
  return getLeaveDateKeysForWeekday(leave, schedule?.day).filter((dateKey) => {
    if (holidays.has(dateKey)) return false;
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
