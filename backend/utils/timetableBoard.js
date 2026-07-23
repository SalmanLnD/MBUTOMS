import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from './scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { isScheduleDayInLeaveRange } from './trainerScheduleView.js';
import { getCanceledScheduleIdsForDate } from './classCancellations.js';

// Only the fields the timetable grid renders — keeps the board payload small.
const BOARD_SCHEDULE_FIELDS =
  'trainerCode day startTime endTime department section subjectCode subject slot semester replacementFor venue isLab isProject';

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

  const [ownedSchedules, leaves, canceledScheduleIds] = await Promise.all([
    Schedule.find(ownedFilter)
      .select(BOARD_SCHEDULE_FIELDS)
      .populate('venue', 'name building floor')
      .lean(),
    Leave.find({
      status: 'approved',
      startDate: { $lte: ref },
      endDate: { $gte: ref },
      'replacements.0': { $exists: true },
    })
      .populate('trainer', 'name employeeId')
      .lean(),
    getCanceledScheduleIdsForDate(ref),
  ]);

  const ownedIds = new Set();

  ownedSchedules.forEach((schedule) => {
    if (canceledScheduleIds.has(schedule._id.toString())) return;
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
      .select(BOARD_SCHEDULE_FIELDS)
      .populate('venue', 'name building floor')
      .lean();
    const scheduleById = new Map(
      replacementSchedules.map((schedule) => [schedule._id.toString(), schedule])
    );
    const seenBoardKeys = new Set();

    leaves.forEach((leave) => {
      leave.replacements?.forEach((entry) => {
        const schedule = scheduleById.get(entry.schedule?.toString());
        if (!schedule) return;
        if (canceledScheduleIds.has(schedule._id.toString())) return;
        if (semester && schedule.semester !== semester) return;
        if (!isScheduleDayInLeaveRange(schedule.day, leave)) return;
        if (ownedIds.has(schedule._id.toString())) return;

        const replacementPayload = {
          ...schedule,
          replacementFor: {
            trainerCode: leave.trainer?.employeeId || '',
            trainerName: leave.trainer?.name || '',
          },
          isReplacementAssignment: true,
        };

        const replacementTrainerId = entry.replacementTrainer?.toString();
        const trainer = replacementTrainerId ? trainerById.get(replacementTrainerId) : null;
        if (trainer) {
          const boardKey = `${trainer.employeeId}|${schedule._id.toString()}`;
          if (seenBoardKeys.has(boardKey)) return;
          seenBoardKeys.add(boardKey);
          board[trainer.employeeId].push({
            ...replacementPayload,
            trainerCode: trainer.employeeId,
          });
          return;
        }

        const externalName = entry.isExternal
          ? String(entry.externalTrainerName || '').trim()
          : '';
        if (!externalName) return;

        const key = `external:${externalName.toLowerCase()}`;
        const boardKey = `${key}|${schedule._id.toString()}`;
        if (seenBoardKeys.has(boardKey)) return;
        seenBoardKeys.add(boardKey);
        if (!board[key]) board[key] = [];
        board[key].push({
          ...replacementPayload,
          trainerCode: key,
          isExternal: true,
          externalTrainerName: externalName,
        });
      });
    });
  }

  return { schedulesByTrainer: board, trainerCount: trainers.length };
};
