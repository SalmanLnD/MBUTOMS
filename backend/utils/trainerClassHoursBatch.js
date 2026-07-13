import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceTracking.js';
import { getAttendanceWeekdayName } from './attendanceDates.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { computeHours } from './trainerClassHours.js';
import {
  buildSubjectStartDateMap,
  DEFAULT_SUBJECT_START_DATE,
} from './subjectStartDate.js';
import { getWeekdaysInLeaveRange } from './trainerScheduleView.js';

const SCHEDULE_FIELDS = 'day startTime endTime trainerCode semester subject subjectCode';

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
  const ref = normalizeAttendanceDate(referenceDate);
  const rawStart = resolveStartDate(schedule, subjectStartMap);
  const effectiveStart = rawStart
    ? normalizeAttendanceDate(rawStart)
    : DEFAULT_SUBJECT_START_DATE;
  return ref >= effectiveStart;
};

const buildTrainerLookup = (trainers) => {
  const trainerById = new Map();
  const codeToTrainerId = new Map();

  trainers.forEach((trainer) => {
    const trainerId = trainer._id.toString();
    trainerById.set(trainerId, trainer);
    resolveTrainerScheduleCodes(trainer).forEach((code) => {
      codeToTrainerId.set(code, trainerId);
    });
  });

  return { trainerById, codeToTrainerId, allCodes: [...codeToTrainerId.keys()] };
};

// One trainer can own the same slot under multiple codes (e.g. employeeId and a
// legacy timetable code); count each physical slot once.
export const buildSlotIdentityKey = (schedule) =>
  [
    schedule.day,
    schedule.startTime,
    schedule.endTime,
    schedule.department || '',
    schedule.section || '',
    schedule.subjectCode || '',
    schedule.semester || '',
  ].join('|');

const indexSchedulesByTrainerDay = (schedules, codeToTrainerId) => {
  const schedulesByTrainerDay = new Map();
  const seenSlotKeys = new Map();

  schedules.forEach((schedule) => {
    const trainerId = codeToTrainerId.get(schedule.trainerCode);
    if (!trainerId) return;

    let seen = seenSlotKeys.get(trainerId);
    if (!seen) {
      seen = new Set();
      seenSlotKeys.set(trainerId, seen);
    }
    const slotKey = buildSlotIdentityKey(schedule);
    if (seen.has(slotKey)) return;
    seen.add(slotKey);

    let byDay = schedulesByTrainerDay.get(trainerId);
    if (!byDay) {
      byDay = new Map();
      schedulesByTrainerDay.set(trainerId, byDay);
    }

    let daySchedules = byDay.get(schedule.day);
    if (!daySchedules) {
      daySchedules = [];
      byDay.set(schedule.day, daySchedules);
    }
    daySchedules.push(schedule);
  });

  return schedulesByTrainerDay;
};

export const computeClassHandlingHoursBatch = async (
  trainerIds,
  dates,
  semester = null,
  trainersInput = null
) => {
  const result = new Map();
  if (!trainerIds.length || !dates.length) return result;

  const trainers = trainersInput?.length
    ? trainersInput
    : await Trainer.find({ _id: { $in: trainerIds } })
      .select('name employeeId scheduleTrainerCodes')
      .lean();

  const { trainerById, codeToTrainerId, allCodes } = buildTrainerLookup(trainers);
  if (!allCodes.length) return result;

  const rangeStart = normalizeAttendanceDate(dates[0]);
  const rangeEnd = normalizeAttendanceDate(dates[dates.length - 1]);

  const ownedFilter = { trainerCode: { $in: allCodes } };
  if (semester) ownedFilter.semester = semester;

  const [ownedSchedules, subjectStartMap, leaves] = await Promise.all([
    Schedule.find(ownedFilter).select(SCHEDULE_FIELDS).lean(),
    buildSubjectStartDateMap(),
    Leave.find({
      status: 'approved',
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
      'replacements.replacementTrainer': { $in: trainerIds },
    })
      .select('startDate endDate replacements')
      .lean(),
  ]);

  const schedulesByTrainerDay = indexSchedulesByTrainerDay(ownedSchedules, codeToTrainerId);

  const replacementScheduleIds = [
    ...new Set(
      leaves.flatMap((leave) =>
        (leave.replacements || []).map((entry) => entry.schedule?.toString()).filter(Boolean)
      )
    ),
  ];

  const replacementSchedules = replacementScheduleIds.length
    ? await Schedule.find({ _id: { $in: replacementScheduleIds } }).select(SCHEDULE_FIELDS).lean()
    : [];

  const scheduleById = new Map(
    replacementSchedules.map((schedule) => [schedule._id.toString(), schedule])
  );

  const leaveWeekdays = new Map(
    leaves.map((leave) => [
      leave._id.toString(),
      new Set(getWeekdaysInLeaveRange(leave.startDate, leave.endDate)),
    ])
  );

  const replacementByTrainerDate = new Map();

  dates.forEach((date) => {
    const dateKey = toAttendanceDateKey(date);
    const dayName = getAttendanceWeekdayName(date);

    leaves.forEach((leave) => {
      const leaveDays = leaveWeekdays.get(leave._id.toString());
      if (!leaveDays?.has(dayName)) return;

      leave.replacements?.forEach((entry) => {
        const replacementTrainerId = entry.replacementTrainer?.toString();
        if (!replacementTrainerId || !trainerById.has(replacementTrainerId)) return;

        const schedule = scheduleById.get(entry.schedule?.toString());
        if (!schedule || schedule.day !== dayName) return;
        if (semester && schedule.semester !== semester) return;
        if (!isActiveOnDate(schedule, date, subjectStartMap)) return;

        const key = `${replacementTrainerId}|${dateKey}`;
        let entries = replacementByTrainerDate.get(key);
        if (!entries) {
          entries = [];
          replacementByTrainerDate.set(key, entries);
        }
        entries.push(schedule);
      });
    });
  });

  dates.forEach((date) => {
    const dateKey = toAttendanceDateKey(date);
    const dayName = getAttendanceWeekdayName(date);

    trainers.forEach((trainer) => {
      const trainerId = trainer._id.toString();
      const owned = (schedulesByTrainerDay.get(trainerId)?.get(dayName) || []).filter((schedule) =>
        isActiveOnDate(schedule, date, subjectStartMap)
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
