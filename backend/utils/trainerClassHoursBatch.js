import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from './scheduleHelpers.js';
import { toDateKey } from './dateRange.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { computeHours } from './trainerClassHours.js';
import {
  buildSubjectStartDateMap,
  DEFAULT_SUBJECT_START_DATE,
} from './subjectStartDate.js';
import { isScheduleDayInLeaveRange } from './trainerScheduleView.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const resolveStartDate = (schedule, subjectStartMap) => {
  const subjectId = schedule.subject?.toString();
  if (subjectId && subjectStartMap.byId.has(subjectId)) {
    return subjectStartMap.byId.get(subjectId);
  }
  const subjectCode = schedule.subjectCode?.trim();
  if (subjectCode && subjectStartMap.byCode.has(subjectCode)) {
    return subjectStartMap.byCode.get(subjectCode);
  }
  return null;
};

const isActiveOnDate = (schedule, referenceDate, subjectStartMap) => {
  const ref = normalizeDate(referenceDate);
  const startDate = resolveStartDate(schedule, subjectStartMap);
  const effectiveStart = startDate ?? DEFAULT_SUBJECT_START_DATE;
  return ref >= effectiveStart;
};

export const computeClassHandlingHoursBatch = async (
  trainerIds,
  dates,
  semester = 'III'
) => {
  const result = new Map();
  if (!trainerIds.length || !dates.length) return result;

  const trainers = await Trainer.find({ _id: { $in: trainerIds } }).lean();
  const trainerById = new Map(trainers.map((trainer) => [trainer._id.toString(), trainer]));

  const codeToTrainerId = new Map();
  const allCodes = new Set();
  trainers.forEach((trainer) => {
    resolveTrainerScheduleCodes(trainer).forEach((code) => {
      allCodes.add(code);
      codeToTrainerId.set(code, trainer._id.toString());
    });
  });

  const rangeStart = normalizeDate(dates[0]);
  const rangeEnd = normalizeDate(dates[dates.length - 1]);

  const ownedFilter = { trainerCode: { $in: [...allCodes] } };
  if (semester) ownedFilter.semester = semester;

  const [ownedSchedules, subjectStartMap, leaves] = await Promise.all([
    Schedule.find(ownedFilter).lean(),
    buildSubjectStartDateMap(),
    Leave.find({
      status: 'approved',
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
      'replacements.0': { $exists: true },
    })
      .populate('trainer', 'name employeeId')
      .lean(),
  ]);

  const schedulesByTrainer = new Map();
  ownedSchedules.forEach((schedule) => {
    const trainerId = codeToTrainerId.get(schedule.trainerCode);
    if (!trainerId) return;
    if (!schedulesByTrainer.has(trainerId)) schedulesByTrainer.set(trainerId, []);
    schedulesByTrainer.get(trainerId).push(schedule);
  });

  const replacementScheduleIds = [
    ...new Set(
      leaves.flatMap((leave) =>
        (leave.replacements || []).map((entry) => entry.schedule?.toString()).filter(Boolean)
      )
    ),
  ];

  const replacementSchedules = replacementScheduleIds.length
    ? await Schedule.find({ _id: { $in: replacementScheduleIds } }).lean()
    : [];
  const scheduleById = new Map(
    replacementSchedules.map((schedule) => [schedule._id.toString(), schedule])
  );

  const replacementByTrainerDate = new Map();

  dates.forEach((date) => {
    const dateKey = toDateKey(date);
    const dayName = WEEKDAYS[date.getDay()];

    leaves.forEach((leave) => {
      leave.replacements?.forEach((entry) => {
        const replacementTrainerId = entry.replacementTrainer?.toString();
        if (!replacementTrainerId || !trainerById.has(replacementTrainerId)) return;

        const schedule = scheduleById.get(entry.schedule?.toString());
        if (!schedule) return;
        if (semester && schedule.semester !== semester) return;
        if (schedule.day !== dayName) return;
        if (!isScheduleDayInLeaveRange(schedule.day, leave)) return;
        if (!isActiveOnDate(schedule, date, subjectStartMap)) return;

        const key = `${replacementTrainerId}|${dateKey}`;
        if (!replacementByTrainerDate.has(key)) replacementByTrainerDate.set(key, []);
        replacementByTrainerDate.get(key).push(schedule);
      });
    });
  });

  dates.forEach((date) => {
    const dateKey = toDateKey(date);
    const dayName = WEEKDAYS[date.getDay()];

    trainers.forEach((trainer) => {
      const trainerId = trainer._id.toString();
      const owned = (schedulesByTrainer.get(trainerId) || []).filter(
        (schedule) =>
          schedule.day === dayName && isActiveOnDate(schedule, date, subjectStartMap)
      );
      const replacements = replacementByTrainerDate.get(`${trainerId}|${dateKey}`) || [];

      const hours = [...owned, ...replacements].reduce(
        (sum, schedule) => sum + computeHours(schedule.startTime, schedule.endTime),
        0
      );

      result.set(`${trainerId}|${dateKey}`, Math.round(hours * 10) / 10);
    });
  });

  return result;
};
