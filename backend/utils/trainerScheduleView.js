import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from './scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getWeekdaysInLeaveRange = (startDate, endDate) => {
  const days = [];
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(WEEKDAYS[cursor.getDay()]);
    cursor.setDate(cursor.getDate() + 1);
  }

  return [...new Set(days)];
};

export const isScheduleDayInLeaveRange = (scheduleDay, leave) =>
  getWeekdaysInLeaveRange(leave.startDate, leave.endDate).includes(scheduleDay);

export const buildTrainerSchedulesForDate = async ({
  trainerCode,
  trainerId,
  referenceDate = new Date(),
  semester,
}) => {
  let trainer = null;
  if (trainerId) {
    trainer = await Trainer.findById(trainerId);
  } else if (trainerCode) {
    trainer = await Trainer.findOne({ employeeId: trainerCode });
  }
  if (!trainer) return [];

  const scheduleCodes = resolveTrainerScheduleCodes(trainer);
  const ownedFilter = { trainerCode: { $in: scheduleCodes } };
  if (semester) ownedFilter.semester = semester;

  const owned = await Schedule.find(ownedFilter);
  const ref = normalizeDate(referenceDate);

  const leaves = await Leave.find({
    status: 'approved',
    startDate: { $lte: ref },
    endDate: { $gte: ref },
    'replacements.replacementTrainer': trainer._id,
  })
    .populate('trainer', 'name employeeId')
    .populate('affectedSchedules');

  const ownedIds = new Set(owned.map((schedule) => schedule._id.toString()));
  const replacementSchedules = [];

  leaves.forEach((leave) => {
    leave.replacements?.forEach((entry) => {
      const replacementTrainerId =
        entry.replacementTrainer?._id?.toString() || entry.replacementTrainer?.toString();
      if (replacementTrainerId !== trainer._id.toString()) return;

      const schedule = (leave.affectedSchedules || []).find(
        (item) => item && item._id.toString() === entry.schedule.toString()
      );
      if (!schedule) return;
      if (semester && schedule.semester !== semester) return;
      if (!isScheduleDayInLeaveRange(schedule.day, leave)) return;
      if (ownedIds.has(schedule._id.toString())) return;

      const plain = schedule.toObject ? schedule.toObject() : { ...schedule };
      replacementSchedules.push({
        ...plain,
        trainerCode: trainer.employeeId,
        replacementFor: {
          trainerCode: leave.trainer.employeeId,
          trainerName: leave.trainer.name,
        },
        isReplacementAssignment: true,
      });
    });
  });

  return [
    ...owned.map((schedule) => (schedule.toObject ? schedule.toObject() : { ...schedule })),
    ...replacementSchedules,
  ];
};
