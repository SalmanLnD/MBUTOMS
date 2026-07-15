import ClassCancellation from '../models/ClassCancellation.js';
import { normalizeAttendanceDate } from './attendanceTracking.js';
import {
  getLeaveDateKeysForWeekday,
  toLeaveDateKey,
} from './leaveDateRange.js';

const getScheduleId = (schedule) =>
  schedule?._id?.toString?.() || schedule?.toString?.() || '';

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

export const getUncancelledScheduleDateKeys = (
  leave,
  schedule,
  canceledScheduleIdsByDate = new Map()
) => {
  const scheduleId = getScheduleId(schedule);
  return getLeaveDateKeysForWeekday(leave, schedule?.day).filter(
    (dateKey) => !canceledScheduleIdsByDate.get(dateKey)?.has(scheduleId)
  );
};

export const buildAffectedClassOccurrences = (
  leave,
  schedules = leave?.affectedSchedules || [],
  canceledScheduleIdsByDate = new Map()
) =>
  schedules.flatMap((schedule) =>
    getUncancelledScheduleDateKeys(leave, schedule, canceledScheduleIdsByDate)
      .map((date) => ({ schedule, date }))
  );

export const getEffectiveAffectedSchedules = (
  leave,
  schedules = leave?.affectedSchedules || [],
  canceledScheduleIdsByDate = new Map()
) =>
  schedules.filter(
    (schedule) =>
      getUncancelledScheduleDateKeys(leave, schedule, canceledScheduleIdsByDate).length > 0
  );
