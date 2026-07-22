import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import { timesOverlap } from './timetableSlots.js';
import { isDateWithinLeave, toLeaveDateKey } from './leaveDateRange.js';
import { isScheduleDayInLeaveRange } from './trainerScheduleView.js';

/**
 * Load campus replacement assignments that keep a trainer busy in a date range.
 * External replacements are ignored (they are not roster trainers).
 */
export const loadReplacementBusySlotsByTrainer = async ({
  trainerIds = [],
  rangeStart,
  rangeEnd,
  exclude = {},
} = {}) => {
  const ids = [...new Set(trainerIds.filter(Boolean).map(String))];
  const busyByTrainer = new Map(ids.map((id) => [id, []]));
  if (!ids.length || !rangeStart || !rangeEnd) return busyByTrainer;

  const excludeLeaveId = exclude.leaveId?.toString?.() || exclude.leaveId || '';
  const excludeScheduleId = exclude.scheduleId?.toString?.() || exclude.scheduleId || '';

  const leaves = await Leave.find({
    status: 'approved',
    startDate: { $lte: rangeEnd },
    endDate: { $gte: rangeStart },
    'replacements.replacementTrainer': { $in: ids },
  })
    .select('_id startDate endDate replacements')
    .lean();

  const scheduleIds = [
    ...new Set(
      leaves.flatMap((leave) =>
        (leave.replacements || [])
          .filter((entry) => entry.replacementTrainer && !entry.isExternal)
          .map((entry) => entry.schedule?.toString())
          .filter(Boolean)
      )
    ),
  ];

  if (!scheduleIds.length) return busyByTrainer;

  const schedules = await Schedule.find({ _id: { $in: scheduleIds } })
    .select('_id day startTime endTime')
    .lean();
  const scheduleById = new Map(
    schedules.map((schedule) => [schedule._id.toString(), schedule])
  );

  leaves.forEach((leave) => {
    const leaveId = leave._id.toString();
    (leave.replacements || []).forEach((entry) => {
      if (entry.isExternal) return;
      const trainerId = entry.replacementTrainer?.toString();
      if (!trainerId || !busyByTrainer.has(trainerId)) return;

      const scheduleId = entry.schedule?.toString();
      if (!scheduleId) return;
      if (excludeLeaveId && leaveId === excludeLeaveId && scheduleId === excludeScheduleId) {
        return;
      }

      const schedule = scheduleById.get(scheduleId);
      if (!schedule) return;
      if (!isScheduleDayInLeaveRange(schedule.day, leave)) return;

      busyByTrainer.get(trainerId).push({
        leaveId,
        scheduleId,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        leaveStart: leave.startDate,
        leaveEnd: leave.endDate,
      });
    });
  });

  return busyByTrainer;
};

/**
 * True when the trainer already covers an overlapping replacement on any affected date.
 */
export const trainerHasOverlappingReplacement = ({
  busySlots = [],
  day,
  startTime,
  endTime,
  dateKeys = [],
  cancellationMap = new Map(),
} = {}) => {
  if (!busySlots.length || !dateKeys.length) return false;

  return dateKeys.some((dateKey) => {
    const canceledIds = cancellationMap.get(dateKey) || new Set();
    return busySlots.some((slot) => {
      if (slot.day !== day) return false;
      if (canceledIds.has(slot.scheduleId)) return false;
      if (!isDateWithinLeave(dateKey, {
        startDate: slot.leaveStart,
        endDate: slot.leaveEnd,
      })) return false;
      return timesOverlap(startTime, endTime, slot.startTime, slot.endTime);
    });
  });
};

/**
 * True when owned weekly timetable slots overlap the target slot on affected dates.
 */
export const trainerHasOverlappingOwnedSchedule = ({
  ownedSchedules = [],
  day,
  startTime,
  endTime,
  dateKeys = [],
  cancellationMap = new Map(),
} = {}) => {
  if (!ownedSchedules.length || !dateKeys.length) return false;

  return dateKeys.some((dateKey) => {
    const canceledIds = cancellationMap.get(dateKey) || new Set();
    return ownedSchedules.some((slot) => {
      if (slot.day !== day) return false;
      const slotId = slot._id?.toString?.() || slot._id;
      if (slotId && canceledIds.has(String(slotId))) return false;
      return timesOverlap(startTime, endTime, slot.startTime, slot.endTime);
    });
  });
};

export const trainerHasSlotConflict = ({
  ownedSchedules = [],
  replacementBusySlots = [],
  day,
  startTime,
  endTime,
  dateKeys = [],
  cancellationMap = new Map(),
} = {}) =>
  trainerHasOverlappingOwnedSchedule({
    ownedSchedules,
    day,
    startTime,
    endTime,
    dateKeys,
    cancellationMap,
  })
  || trainerHasOverlappingReplacement({
    busySlots: replacementBusySlots,
    day,
    startTime,
    endTime,
    dateKeys,
    cancellationMap,
  });

export { toLeaveDateKey };
