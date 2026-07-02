import Leave from '../models/Leave.js';
import { normalizeDate } from './scheduleHelpers.js';
import { isLeaveActiveOnDate } from './leaveStatus.js';

const toPlainSchedule = (schedule) => (schedule.toObject ? schedule.toObject() : { ...schedule });

export const enrichSchedulesWithReplacementFor = async (schedules, referenceDate = new Date()) => {
  if (!schedules?.length) return [];

  const scheduleList = schedules.map(toPlainSchedule);
  const scheduleIds = scheduleList.map((schedule) => schedule._id);

  const leaves = await Leave.find({
    status: 'approved',
    affectedSchedules: { $in: scheduleIds },
    'replacements.0': { $exists: true },
  })
    .populate('trainer', 'name employeeId')
    .populate('replacements.replacementTrainer', 'name employeeId');

  const replacementBySchedule = new Map();

  leaves.forEach((leave) => {
    if (!isLeaveActiveOnDate(leave, referenceDate)) return;

    const originalCode = leave.trainer?.employeeId;
    const originalName = leave.trainer?.name;
    if (!originalCode || !originalName) return;

    leave.replacements?.forEach((entry) => {
      const scheduleId = entry.schedule?.toString();
      if (!scheduleId) return;
      if (!scheduleIds.some((id) => id.toString() === scheduleId)) return;

      const replacementTrainer = entry.replacementTrainer;
      if (!replacementTrainer) return;

      replacementBySchedule.set(scheduleId, {
        trainerCode: originalCode,
        trainerName: originalName,
        replacementTrainerCode: replacementTrainer.employeeId,
        replacementTrainerName: replacementTrainer.name,
      });
    });
  });

  return scheduleList.map((schedule) => {
    const info = replacementBySchedule.get(schedule._id.toString());
    if (!info) {
      return { ...schedule, replacementFor: undefined };
    }

    if (schedule.trainerCode === info.replacementTrainerCode) {
      return {
        ...schedule,
        replacementFor: {
          trainerCode: info.trainerCode,
          trainerName: info.trainerName,
        },
      };
    }

    return schedule;
  });
};

export const formatScheduleClassLabel = (schedule) => {
  const base = `${schedule.department || ''} ${schedule.section || ''}`.trim();
  const trainerName = schedule.replacementFor?.trainerName?.trim();
  if (!trainerName) return base;
  return `${base} (${trainerName}'s class)`;
};
