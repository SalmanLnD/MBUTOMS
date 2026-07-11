import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from './scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { isScheduleDayInLeaveRange } from './trainerScheduleView.js';

const buildTrainerCodeIndex = (trainers) => {
  const codeToTrainers = new Map();
  trainers.forEach((trainer) => {
    resolveTrainerScheduleCodes(trainer).forEach((code) => {
      if (!codeToTrainers.has(code)) codeToTrainers.set(code, []);
      codeToTrainers.get(code).push(trainer);
    });
  });
  return codeToTrainers;
};

export const buildTimetableBoardForDate = async ({
  referenceDate = new Date(),
  semester,
} = {}) => {
  const trainers = await Trainer.find()
    .select('name employeeId scheduleTrainerCodes')
    .sort({ employeeId: 1 })
    .lean();

  const codeToTrainers = buildTrainerCodeIndex(trainers);
  const allCodes = [...codeToTrainers.keys()];

  const board = Object.fromEntries(
    trainers.map((trainer) => [trainer.employeeId, []])
  );

  if (!allCodes.length) {
    return { schedulesByTrainer: board, trainerCount: trainers.length };
  }

  const ownedFilter = { trainerCode: { $in: allCodes } };
  if (semester) ownedFilter.semester = semester;

  const ref = normalizeDate(referenceDate);
  const trainerById = new Map(trainers.map((trainer) => [trainer._id.toString(), trainer]));

  const [ownedSchedules, leaves] = await Promise.all([
    Schedule.find(ownedFilter).populate('venue', 'name building floor type').lean(),
    Leave.find({
      status: 'approved',
      startDate: { $lte: ref },
      endDate: { $gte: ref },
      'replacements.0': { $exists: true },
    })
      .populate('trainer', 'name employeeId')
      .lean(),
  ]);

  const ownedIds = new Set();

  ownedSchedules.forEach((schedule) => {
    const matches = codeToTrainers.get(schedule.trainerCode) || [];
    matches.forEach((trainer) => {
      ownedIds.add(schedule._id.toString());
      board[trainer.employeeId].push({ ...schedule });
    });
  });

  const replacementScheduleIds = [
    ...new Set(
      leaves.flatMap((leave) =>
        (leave.replacements || []).map((entry) => entry.schedule?.toString()).filter(Boolean)
      )
    ),
  ];

  if (replacementScheduleIds.length) {
    const replacementSchedules = await Schedule.find({
      _id: { $in: replacementScheduleIds },
    })
      .populate('venue', 'name building floor type')
      .lean();
    const scheduleById = new Map(
      replacementSchedules.map((schedule) => [schedule._id.toString(), schedule])
    );

    leaves.forEach((leave) => {
      leave.replacements?.forEach((entry) => {
        const replacementTrainerId = entry.replacementTrainer?.toString();
        const trainer = trainerById.get(replacementTrainerId);
        if (!trainer) return;

        const schedule = scheduleById.get(entry.schedule?.toString());
        if (!schedule) return;
        if (semester && schedule.semester !== semester) return;
        if (!isScheduleDayInLeaveRange(schedule.day, leave)) return;
        if (ownedIds.has(schedule._id.toString())) return;

        board[trainer.employeeId].push({
          ...schedule,
          trainerCode: trainer.employeeId,
          replacementFor: {
            trainerCode: leave.trainer?.employeeId || '',
            trainerName: leave.trainer?.name || '',
          },
          isReplacementAssignment: true,
        });
      });
    });
  }

  return { schedulesByTrainer: board, trainerCount: trainers.length };
};
