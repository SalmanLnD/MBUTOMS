import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import {
  getAttendanceCalendarDates,
  getAttendanceWeekdayName,
} from './attendanceDates.js';
import {
  TRAINER_ATTENDANCE_TRACKING_START,
  toAttendanceDateKey,
} from './attendanceTracking.js';
import { getLeaveOverlapFilter, getLeaveDateKeysInWindow } from './leaveDateRange.js';
import { getLeaveWeekdayScheduleIds, isFullDayLeave } from './leaveScope.js';
import {
  getCancellationMapForRange,
  hasUncancelledClassOnDate,
} from './leaveAffectedClasses.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';

/**
 * Date keys in a range that count as replacement-required for one trainer.
 * Full-day leave on a day that still has uncancelled classes, excluding holidays.
 */
export const collectRrdDateKeys = ({
  dates = [],
  leaveDateKeys = new Set(),
  schedules = [],
  holidayMap = new Map(),
  cancellationMap = new Map(),
} = {}) => {
  const keys = [];
  dates.forEach((date) => {
    const dateKey = toAttendanceDateKey(date);
    if (!dateKey || holidayMap.has(dateKey) || !leaveDateKeys.has(dateKey)) return;
    if (hasUncancelledClassOnDate(
      schedules,
      dateKey,
      getAttendanceWeekdayName(date),
      cancellationMap
    )) {
      keys.push(dateKey);
    }
  });
  return keys;
};

/**
 * First RRD in a month stays Leave. Any further RRD in that month defaults to E-Leave.
 * If the trainer already has an RRD in the month, every RRD in the new leave is E-Leave.
 */
export const planExcessRrdAttendanceTypes = (
  rrdDateKeys = [],
  priorRrdCountByMonth = new Map()
) => {
  const byMonth = new Map();
  [...rrdDateKeys].sort().forEach((dateKey) => {
    const monthKey = String(dateKey || '').slice(0, 7);
    if (!monthKey) return;
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey).push(dateKey);
  });

  const leaveKeys = [];
  const eLeaveKeys = [];
  byMonth.forEach((dateKeys, monthKey) => {
    const prior = Number(priorRrdCountByMonth.get(monthKey) || 0);
    if (prior >= 1) {
      eLeaveKeys.push(...dateKeys);
      return;
    }
    const [first, ...rest] = dateKeys;
    if (first) leaveKeys.push(first);
    eLeaveKeys.push(...rest);
  });
  return { leaveKeys, eLeaveKeys };
};

/** Map of trainerId -> Replacement Required Days count for an inclusive date range. */
export const getReplacementRequiredDaysByTrainer = async ({
  startDate,
  endDate,
  trainers = [],
} = {}) => {
  const counts = new Map(trainers.map((trainer) => [trainer._id.toString(), 0]));
  if (!trainers.length || !startDate || !endDate) return counts;

  let rangeStart = startDate < TRAINER_ATTENDANCE_TRACKING_START
    ? TRAINER_ATTENDANCE_TRACKING_START
    : startDate;
  if (rangeStart > endDate) return counts;

  const dates = getAttendanceCalendarDates(rangeStart, endDate);
  if (!dates.length) return counts;

  const trainerIds = trainers.map((trainer) => trainer._id);
  const codesByTrainer = new Map(
    trainers.map((trainer) => [trainer._id.toString(), resolveTrainerScheduleCodes(trainer)])
  );
  const allScheduleCodes = [...new Set([...codesByTrainer.values()].flat())];

  const [approvedLeaves, schedules, holidayMap, cancellationMap] = await Promise.all([
    Leave.find({
      trainer: { $in: trainerIds },
      status: 'approved',
      ...getLeaveOverlapFilter(rangeStart, endDate),
    })
      .select('trainer startDate endDate reason scope affectedSchedules')
      .lean(),
    allScheduleCodes.length
      ? Schedule.find({ trainerCode: { $in: allScheduleCodes } })
        .select('_id trainerCode day')
        .lean()
      : [],
    loadOfficialHolidayMap(rangeStart, endDate),
    getCancellationMapForRange(rangeStart, endDate),
  ]);

  const schedulesByCode = new Map();
  schedules.forEach((schedule) => {
    if (!schedulesByCode.has(schedule.trainerCode)) {
      schedulesByCode.set(schedule.trainerCode, []);
    }
    schedulesByCode.get(schedule.trainerCode).push(schedule);
  });

  const schedulesByTrainer = new Map();
  trainers.forEach((trainer) => {
    const trainerId = trainer._id.toString();
    const trainerSchedules = (codesByTrainer.get(trainerId) || [])
      .flatMap((code) => schedulesByCode.get(code) || []);
    schedulesByTrainer.set(trainerId, trainerSchedules);
  });

  const fromKey = toAttendanceDateKey(rangeStart);
  const untilKey = toAttendanceDateKey(endDate);

  const fullDayLeaveKeys = new Set();
  approvedLeaves.forEach((leave) => {
    const trainerId = leave.trainer.toString();
    const dayScheduleIds = getLeaveWeekdayScheduleIds(
      leave,
      schedulesByTrainer.get(trainerId) || []
    );
    if (!isFullDayLeave(leave, { dayScheduleIds })) return;

    getLeaveDateKeysInWindow(leave, fromKey, untilKey).forEach((dateKey) => {
      fullDayLeaveKeys.add(`${trainerId}|${dateKey}`);
    });
  });

  trainers.forEach((trainer) => {
    const trainerId = trainer._id.toString();
    const leaveDateKeys = new Set();
    dates.forEach((date) => {
      const dateKey = toAttendanceDateKey(date);
      if (fullDayLeaveKeys.has(`${trainerId}|${dateKey}`)) leaveDateKeys.add(dateKey);
    });
    counts.set(
      trainerId,
      collectRrdDateKeys({
        dates,
        leaveDateKeys,
        schedules: schedulesByTrainer.get(trainerId) || [],
        holidayMap,
        cancellationMap,
      }).length
    );
  });

  return counts;
};

export const getTrainerRrdDateKeys = async ({
  trainer,
  startDate,
  endDate,
  excludeLeaveId = null,
  onlyLeaveId = null,
} = {}) => {
  if (!trainer?._id || !startDate || !endDate) return [];
  const trainerId = trainer._id.toString();
  let rangeStart = startDate < TRAINER_ATTENDANCE_TRACKING_START
    ? TRAINER_ATTENDANCE_TRACKING_START
    : startDate;
  if (rangeStart > endDate) return [];

  const dates = getAttendanceCalendarDates(rangeStart, endDate);
  if (!dates.length) return [];

  const codes = resolveTrainerScheduleCodes(trainer);
  const leaveQuery = {
    trainer: trainer._id,
    status: 'approved',
    ...getLeaveOverlapFilter(rangeStart, endDate),
  };
  if (onlyLeaveId) leaveQuery._id = onlyLeaveId;
  if (excludeLeaveId) leaveQuery._id = { $ne: excludeLeaveId };

  const [approvedLeaves, schedules, holidayMap, cancellationMap] = await Promise.all([
    Leave.find(leaveQuery)
      .select('trainer startDate endDate reason scope affectedSchedules')
      .lean(),
    codes.length
      ? Schedule.find({ trainerCode: { $in: codes } }).select('_id trainerCode day').lean()
      : [],
    loadOfficialHolidayMap(rangeStart, endDate),
    getCancellationMapForRange(rangeStart, endDate),
  ]);

  const fromKey = toAttendanceDateKey(rangeStart);
  const untilKey = toAttendanceDateKey(endDate);
  const leaveDateKeys = new Set();
  approvedLeaves.forEach((leave) => {
    const dayScheduleIds = getLeaveWeekdayScheduleIds(leave, schedules);
    if (!isFullDayLeave(leave, { dayScheduleIds })) return;
    getLeaveDateKeysInWindow(leave, fromKey, untilKey).forEach((dateKey) => {
      leaveDateKeys.add(dateKey);
    });
  });

  return collectRrdDateKeys({
    dates,
    leaveDateKeys,
    schedules,
    holidayMap,
    cancellationMap,
  });
};
