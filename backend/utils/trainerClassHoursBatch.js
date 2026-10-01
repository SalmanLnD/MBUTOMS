import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceTracking.js';
import { getAttendanceWeekdayName } from './attendanceDates.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { isBeforeTrainerJoiningDate } from './trainerEmployment.js';
import { computeHours } from './trainerClassHours.js';
import {
  buildSubjectStartDateMap,
  DEFAULT_SUBJECT_START_DATE,
  DEFAULT_SUBJECT_END_DATE,
} from './subjectStartDate.js';
import { SPECIAL_CLASS_FIELDS, isSpecialSchedule, isSpecialScheduleActiveOnDate } from './specialClass.js';
import { getWeekdaysInLeaveRange } from './trainerScheduleView.js';
import {
  getLeaveOverlapFilter,
  isDateWithinLeave,
} from './leaveDateRange.js';
import { getCancellationMapForRange } from './leaveAffectedClasses.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';

const SCHEDULE_FIELDS = `day startTime endTime trainerCode semester subject subjectCode ${SPECIAL_CLASS_FIELDS}`;
const EXPLANATION_FIELDS = 'department section slot venue specialReason includeInRtet';

const resolveStartDate = (schedule, subjectStartMap) => {
  const subjectId = schedule.subject?.toString();
  if (subjectId && subjectStartMap.byId.has(subjectId)) {
    return subjectStartMap.byId.get(subjectId).startDate || null;
  }
  const subjectCode = schedule.subjectCode?.trim();
  if (subjectCode && subjectStartMap.byCode.has(subjectCode)) {
    return subjectStartMap.byCode.get(subjectCode).startDate || null;
  }
  return null;
};

const resolveEndDate = (schedule, subjectStartMap) => {
  const subjectId = schedule.subject?.toString();
  if (subjectId && subjectStartMap.byId.has(subjectId)) {
    return subjectStartMap.byId.get(subjectId).endDate || null;
  }
  const subjectCode = schedule.subjectCode?.trim();
  if (subjectCode && subjectStartMap.byCode.has(subjectCode)) {
    return subjectStartMap.byCode.get(subjectCode).endDate || null;
  }
  return null;
};

const isActiveOnDate = (schedule, referenceDate, subjectStartMap) => {
  if (isSpecialSchedule(schedule)) return isSpecialScheduleActiveOnDate(schedule, referenceDate);
  const ref = normalizeAttendanceDate(referenceDate);
  const rawStart = resolveStartDate(schedule, subjectStartMap);
  const effectiveStart = rawStart
    ? normalizeAttendanceDate(rawStart)
    : DEFAULT_SUBJECT_START_DATE;
  const rawEnd = resolveEndDate(schedule, subjectStartMap);
  const effectiveEnd = rawEnd
    ? normalizeAttendanceDate(rawEnd)
    : DEFAULT_SUBJECT_END_DATE;
  return ref >= effectiveStart && ref <= effectiveEnd;
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

const indexSchedulesByTrainerDay = (schedules, codeToTrainerId, includeDetails = false) => {
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
    // Explanation-only fields must not change the identity used by the existing
    // attendance projection (which does not select department or section).
    const slotKey = buildSlotIdentityKey(includeDetails
      ? { ...schedule, department: undefined, section: undefined }
      : schedule);
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

export const filterOwnedSchedulesForAttendanceDate = (
  schedules,
  {
    replacedScheduleIds = new Set(),
    canceledScheduleIds = new Set(),
    date,
    subjectStartMap,
  }
) => schedules.filter((schedule) => {
  const scheduleId = schedule._id.toString();
  return !replacedScheduleIds.has(scheduleId)
    && !canceledScheduleIds.has(scheduleId)
    && isActiveOnDate(schedule, date, subjectStartMap);
});

export const computeClassHandlingHoursBatch = async (
  trainerIds,
  dates,
  semester = null,
  trainersInput = null,
  { includeDetails = false } = {}
) => {
  const result = new Map();
  if (!trainerIds.length || !dates.length) return result;

  const trainers = trainersInput?.length
    ? trainersInput
    : await Trainer.find({ _id: { $in: trainerIds } })
      .select('name employeeId scheduleTrainerCodes joiningDate')
      .lean();

  const { trainerById, codeToTrainerId, allCodes } = buildTrainerLookup(trainers);
  if (!allCodes.length) return result;

  const rangeStart = normalizeAttendanceDate(dates[0]);
  const rangeEnd = normalizeAttendanceDate(dates[dates.length - 1]);

  const ownedFilter = { trainerCode: { $in: allCodes } };
  if (semester) ownedFilter.semester = semester;

  const [
    ownedSchedules,
    subjectStartMap,
    leaves,
    canceledIdsByDate,
    holidayMap,
  ] = await Promise.all([
    Schedule.find(ownedFilter).select(`${SCHEDULE_FIELDS} ${includeDetails ? EXPLANATION_FIELDS : ''}`).lean(),
    buildSubjectStartDateMap(),
    Leave.find({
      status: 'approved',
      ...getLeaveOverlapFilter(rangeStart, rangeEnd),
      $or: [
        { 'replacements.replacementTrainer': { $in: trainerIds } },
        { trainer: { $in: trainerIds }, 'replacements.0': { $exists: true } },
      ],
    })
      .select('trainer startDate endDate replacements')
      .lean(),
    getCancellationMapForRange(rangeStart, rangeEnd),
    loadOfficialHolidayMap(rangeStart, rangeEnd),
  ]);

  const schedulesByTrainerDay = indexSchedulesByTrainerDay(ownedSchedules, codeToTrainerId, includeDetails);

  const replacementScheduleIds = [
    ...new Set(
      leaves.flatMap((leave) =>
        (leave.replacements || []).map((entry) => entry.schedule?.toString()).filter(Boolean)
      )
    ),
  ];

  const replacementSchedules = replacementScheduleIds.length
    ? await Schedule.find({ _id: { $in: replacementScheduleIds } }).select(`${SCHEDULE_FIELDS} ${includeDetails ? EXPLANATION_FIELDS : ''}`).lean()
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
  const replacedOwnedScheduleIdsByTrainerDate = new Map();
  const replacementDetails = new Map();
  const seenReplacementKeys = new Set();

  dates.forEach((date) => {
    const dateKey = toAttendanceDateKey(date);
    const dayName = getAttendanceWeekdayName(date);
    const canceledIds = canceledIdsByDate.get(dateKey) || new Set();

    leaves.forEach((leave) => {
      if (holidayMap.has(dateKey)) return;
      if (!isDateWithinLeave(date, leave)) return;
      const leaveDays = leaveWeekdays.get(leave._id.toString());
      if (!leaveDays?.has(dayName)) return;

      leave.replacements?.forEach((entry) => {
        const scheduleId = entry.schedule?.toString();
        if (!scheduleId) return;

        const schedule = scheduleById.get(scheduleId);
        if (!schedule || schedule.day !== dayName) return;
        if (canceledIds.has(scheduleId)) return;
        if (semester && schedule.semester !== semester) return;
        if (!isActiveOnDate(schedule, date, subjectStartMap)) return;

        // Always exclude the original trainer's owned hours for a covered slot,
        // including external covers (who do not receive campus hours).
        const originalTrainerId = codeToTrainerId.get(schedule.trainerCode);
        if (originalTrainerId) {
          const originalKey = `${originalTrainerId}|${dateKey}`;
          let replacedIds = replacedOwnedScheduleIdsByTrainerDate.get(originalKey);
          if (!replacedIds) {
            replacedIds = new Set();
            replacedOwnedScheduleIdsByTrainerDate.set(originalKey, replacedIds);
          }
          replacedIds.add(scheduleId);
          if (includeDetails) replacementDetails.set(`${originalKey}|${scheduleId}`, {
            trainerId: entry.replacementTrainer?.toString() || '',
            isExternal: Boolean(entry.isExternal),
            externalTrainerName: entry.isExternal ? entry.externalTrainerName || '' : '',
          });
        }

        const replacementTrainerId = entry.replacementTrainer?.toString();
        if (!replacementTrainerId || !trainerById.has(replacementTrainerId)) return;
        if (entry.isExternal) return;

        const uniqueKey = `${replacementTrainerId}|${dateKey}|${scheduleId}`;
        if (seenReplacementKeys.has(uniqueKey)) return;
        seenReplacementKeys.add(uniqueKey);

        const key = `${replacementTrainerId}|${dateKey}`;
        let entries = replacementByTrainerDate.get(key);
        if (!entries) {
          entries = [];
          replacementByTrainerDate.set(key, entries);
        }
        entries.push(includeDetails ? { ...schedule, isReplacementAssignment: true, replacementForTrainerId: leave.trainer?.toString() || '' } : schedule);
      });
    });
  });

  dates.forEach((date) => {
    const dateKey = toAttendanceDateKey(date);
    const dayName = getAttendanceWeekdayName(date);
    const canceledIds = canceledIdsByDate.get(dateKey) || new Set();

    trainers.forEach((trainer) => {
      const trainerId = trainer._id.toString();
      if (holidayMap.has(dateKey) || isBeforeTrainerJoiningDate(trainer, date)) {
        result.set(`${trainerId}|${dateKey}`, includeDetails ? {
          totalHours: 0,
          schedules: [],
          excludedSchedules: (schedulesByTrainerDay.get(trainerId)?.get(dayName) || []).map((schedule) => ({
            ...schedule,
            exclusion: holidayMap.has(dateKey) ? 'official_holiday' : 'before_joining_date',
          })),
        } : 0);
        return;
      }
      const replacedOwnedIds =
        replacedOwnedScheduleIdsByTrainerDate.get(`${trainerId}|${dateKey}`) || new Set();
      const owned = filterOwnedSchedulesForAttendanceDate(
        schedulesByTrainerDay.get(trainerId)?.get(dayName) || [],
        {
          replacedScheduleIds: replacedOwnedIds,
          canceledScheduleIds: canceledIds,
          date,
          subjectStartMap,
        }
      );
      const replacements = replacementByTrainerDate.get(`${trainerId}|${dateKey}`) || [];

      const hours = [...owned, ...replacements].reduce(
        (sum, schedule) => sum + computeHours(schedule.startTime, schedule.endTime),
        0
      );

      const totalHours = Math.round(hours * 10) / 10;
      result.set(`${trainerId}|${dateKey}`, includeDetails ? {
        totalHours,
        schedules: [...owned, ...replacements],
        excludedSchedules: (schedulesByTrainerDay.get(trainerId)?.get(dayName) || [])
          .filter((schedule) => !owned.includes(schedule))
          .map((schedule) => ({
            ...schedule,
            replacement: replacementDetails.get(`${trainerId}|${dateKey}|${schedule._id}`) || null,
            exclusion: canceledIds.has(schedule._id.toString()) ? 'cancelled_class'
              : replacedOwnedIds.has(schedule._id.toString()) ? 'replacement_covered_class'
                : 'outside_subject_or_special_dates',
          })),
      } : totalHours);
    });
  });

  return result;
};
