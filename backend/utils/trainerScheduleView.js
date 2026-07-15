import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from './scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import {
  getLeaveOverlapFilter,
  isDateWithinLeave,
  toLeaveDateKey,
} from './leaveDateRange.js';
import { getCanceledScheduleIdsForDate } from './classCancellations.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getWeekdaysInLeaveRange = (startDate, endDate) => {
  const days = [];
  const startKey = toLeaveDateKey(startDate);
  const endKey = toLeaveDateKey(endDate);
  if (!startKey || !endKey) return days;

  const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
  const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12));

  while (cursor <= end) {
    days.push(WEEKDAYS[cursor.getUTCDay()]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
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

  const ref = normalizeDate(referenceDate);

  const [ownedSchedules, leaves, canceledScheduleIds] = await Promise.all([
    Schedule.find(ownedFilter).populate('venue', 'name building floor type'),
    Leave.find({
      status: 'approved',
      ...getLeaveOverlapFilter(ref),
      'replacements.replacementTrainer': trainer._id,
    })
      .populate('trainer', 'name employeeId')
      .populate('affectedSchedules'),
    getCanceledScheduleIdsForDate(ref),
  ]);
  const owned = ownedSchedules.filter(
    (schedule) => !canceledScheduleIds.has(schedule._id.toString())
  );

  const ownedIds = new Set(owned.map((schedule) => schedule._id.toString()));
  const replacementSchedules = [];

  leaves.forEach((leave) => {
    if (!isDateWithinLeave(ref, leave)) return;
    leave.replacements?.forEach((entry) => {
      const replacementTrainerId =
        entry.replacementTrainer?._id?.toString() || entry.replacementTrainer?.toString();
      if (replacementTrainerId !== trainer._id.toString()) return;

      const schedule = (leave.affectedSchedules || []).find(
        (item) => item && item._id.toString() === entry.schedule.toString()
      );
      if (!schedule) return;
      if (canceledScheduleIds.has(schedule._id.toString())) return;
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
