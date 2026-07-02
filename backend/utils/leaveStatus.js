import Leave from '../models/Leave.js';
import { normalizeDate } from './scheduleHelpers.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const isLeaveActiveOnDate = (leave, referenceDate = new Date()) => {
  const ref = normalizeDate(referenceDate);
  const start = normalizeDate(leave.startDate);
  const end = normalizeDate(leave.endDate);
  return ref >= start && ref <= end;
};

export const getActiveLeaveTrainerIds = async (referenceDate = new Date()) => {
  const ref = normalizeDate(referenceDate);
  const activeLeaves = await Leave.find({
    status: 'approved',
    startDate: { $lte: ref },
    endDate: { $gte: ref },
  }).select('trainer');

  return new Set(activeLeaves.map((leave) => leave.trainer.toString()));
};

export const isTrainerOnLeave = async (trainerId, referenceDate = new Date()) => {
  const ref = normalizeDate(referenceDate);
  const activeLeave = await Leave.findOne({
    trainer: trainerId,
    status: 'approved',
    startDate: { $lte: ref },
    endDate: { $gte: ref },
  }).select('_id');

  return Boolean(activeLeave);
};

export const isTrainerOnLeaveForScheduleDay = async (trainerId, scheduleDay, leaveStart, leaveEnd) => {
  const start = normalizeDate(leaveStart);
  const end = normalizeDate(leaveEnd);
  const cursor = new Date(start);

  while (cursor <= end) {
    if (WEEKDAYS[cursor.getDay()] === scheduleDay) {
      const onLeave = await Leave.findOne({
        trainer: trainerId,
        status: 'approved',
        startDate: { $lte: cursor },
        endDate: { $gte: cursor },
      }).select('_id');

      if (onLeave) return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return false;
};

export const isTrainerAvailableForReplacement = async ({
  trainerId,
  scheduleDay,
  leaveStart,
  leaveEnd,
  status = 'active',
}) => {
  if (status !== 'active') return false;
  return !(await isTrainerOnLeaveForScheduleDay(trainerId, scheduleDay, leaveStart, leaveEnd));
};
