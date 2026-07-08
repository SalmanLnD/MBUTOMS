import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import { normalizeDate } from './scheduleHelpers.js';
import { getCalendarDates, toDateKey } from './dateRange.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { buildSubjectStartDateMap, DEFAULT_SUBJECT_START_DATE } from './subjectStartDate.js';
import { isScheduleDayInLeaveRange } from './trainerScheduleView.js';
import { isTrainerOnLeave } from './leaveStatus.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const WORK_DAY_START = '09:00';
export const WORK_DAY_END = '17:00';
const LATE_CLASS_END_THRESHOLD = '16:45';

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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

const mergeMinuteIntervals = (intervals) => {
  if (!intervals.length) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
};

const busyToAvailable = (busyIntervals, dayStartMinutes, dayEndMinutes) => {
  const mergedBusy = mergeMinuteIntervals(busyIntervals);
  const available = [];
  let cursor = dayStartMinutes;

  mergedBusy.forEach((interval) => {
    if (interval.start > cursor) {
      available.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
  });

  if (cursor < dayEndMinutes) {
    available.push({ start: cursor, end: dayEndMinutes });
  }

  return available.filter((interval) => interval.end - interval.start >= 15);
};

const normalizeBusyEndMinutes = (endMinutes, dayEndMinutes) => {
  const threshold = parseTimeToMinutes(LATE_CLASS_END_THRESHOLD);
  if (endMinutes >= threshold) {
    return Math.min(dayEndMinutes, parseTimeToMinutes(WORK_DAY_END));
  }
  return endMinutes;
};

const toBusyInterval = (startTime, endTime, dayEndMinutes) => ({
  start: parseTimeToMinutes(startTime),
  end: normalizeBusyEndMinutes(parseTimeToMinutes(endTime), dayEndMinutes),
});

const clipSlotsToRange = (slots, rangeStartMinutes, rangeEndMinutes) =>
  slots
    .map((slot) => {
      const start = Math.max(parseTimeToMinutes(slot.startTime), rangeStartMinutes);
      const end = Math.min(parseTimeToMinutes(slot.endTime), rangeEndMinutes);
      if (end - start < 15) return null;
      return {
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
      };
    })
    .filter(Boolean);

const resolveFilterMinutes = (slotStart, slotEnd, dayStartMinutes, dayEndMinutes) => {
  let start = dayStartMinutes;
  let end = dayEndMinutes;

  if (slotStart) {
    start = Math.max(start, parseTimeToMinutes(slotStart));
  }
  if (slotEnd) {
    end = Math.min(end, parseTimeToMinutes(slotEnd));
  }

  return { start, end };
};

const buildTrainerCodeIndex = (trainers) => {
  const codeToTrainerId = new Map();
  const allCodes = new Set();

  trainers.forEach((trainer) => {
    resolveTrainerScheduleCodes(trainer).forEach((code) => {
      allCodes.add(code);
      codeToTrainerId.set(code, trainer._id.toString());
    });
  });

  return { codeToTrainerId, allCodes: [...allCodes] };
};

export const buildTrainerAvailabilityForRange = async ({
  startDate,
  endDate,
  trainerIds = null,
  subjectId = null,
  slotStart = null,
  slotEnd = null,
  semester,
} = {}) => {
  const rangeStart = normalizeDate(startDate);
  const rangeEnd = normalizeDate(endDate);
  const dates = getCalendarDates(rangeStart, rangeEnd);
  const dayStartMinutes = parseTimeToMinutes(WORK_DAY_START);
  const dayEndMinutes = parseTimeToMinutes(WORK_DAY_END);
  const { start: filterStartMinutes, end: filterEndMinutes } = resolveFilterMinutes(
    slotStart,
    slotEnd,
    dayStartMinutes,
    dayEndMinutes
  );

  if (filterEndMinutes <= filterStartMinutes) {
    return {
      weekStart: rangeStart,
      weekEnd: rangeEnd,
      workDayStart: WORK_DAY_START,
      workDayEnd: WORK_DAY_END,
      filterStart: minutesToTime(filterStartMinutes),
      filterEnd: minutesToTime(filterEndMinutes),
      trainers: [],
    };
  }

  const trainerFilter = { status: 'active' };
  if (trainerIds?.length) {
    trainerFilter._id = { $in: trainerIds };
  }

  let subjectMeta = null;

  if (subjectId) {
    const subject = await Subject.findById(subjectId).select('trainerEligible name code');
    if (!subject) {
      return {
        weekStart: rangeStart,
        weekEnd: rangeEnd,
        workDayStart: WORK_DAY_START,
        workDayEnd: WORK_DAY_END,
        filterStart: minutesToTime(filterStartMinutes),
        filterEnd: minutesToTime(filterEndMinutes),
        subject: null,
        trainers: [],
      };
    }

    subjectMeta = { _id: subject._id, name: subject.name, code: subject.code };
    const eligibleIds = (subject.trainerEligible || []).map((id) => id.toString());
    if (!eligibleIds.length) {
      return {
        weekStart: rangeStart,
        weekEnd: rangeEnd,
        workDayStart: WORK_DAY_START,
        workDayEnd: WORK_DAY_END,
        filterStart: minutesToTime(filterStartMinutes),
        filterEnd: minutesToTime(filterEndMinutes),
        subject: subjectMeta,
        trainers: [],
      };
    }

    if (trainerIds?.length) {
      const allowed = new Set(trainerIds.map((id) => id.toString()));
      trainerFilter._id = {
        $in: eligibleIds.filter((id) => allowed.has(id)),
      };
    } else {
      trainerFilter._id = { $in: eligibleIds };
    }
  }

  const trainers = await Trainer.find(trainerFilter)
    .select('name employeeId scheduleTrainerCodes status')
    .sort({ name: 1 })
    .lean();

  if (!trainers.length) {
    return {
      trainers: [],
      weekStart: rangeStart,
      weekEnd: rangeEnd,
      workDayStart: WORK_DAY_START,
      workDayEnd: WORK_DAY_END,
      filterStart: minutesToTime(filterStartMinutes),
      filterEnd: minutesToTime(filterEndMinutes),
    };
  }

  const { codeToTrainerId, allCodes } = buildTrainerCodeIndex(trainers);
  const trainerById = new Map(trainers.map((trainer) => [trainer._id.toString(), trainer]));

  const ownedFilter = { trainerCode: { $in: allCodes } };
  if (semester) ownedFilter.semester = semester;

  const [ownedSchedules, subjectStartMap, replacementLeaves] = await Promise.all([
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
      replacementLeaves.flatMap((leave) =>
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
    const ref = normalizeDate(date);

    replacementLeaves.forEach((leave) => {
      const leaveStart = normalizeDate(leave.startDate);
      const leaveEnd = normalizeDate(leave.endDate);
      if (ref < leaveStart || ref > leaveEnd) return;

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
        replacementByTrainerDate.get(key).push({
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          source: 'replacement',
        });
      });
    });
  });

  const trainerResults = [];

  for (const trainer of trainers) {
    const trainerId = trainer._id.toString();
    const availability = [];

    for (const date of dates) {
      const dateKey = toDateKey(date);
      const dayName = WEEKDAYS[date.getDay()];

      const onLeave = await isTrainerOnLeave(trainer._id, date);
      if (onLeave) {
        availability.push({
          date: dateKey,
          day: dayName,
          onLeave: true,
          slots: [],
        });
        continue;
      }

      const busyIntervals = [];

      (schedulesByTrainer.get(trainerId) || []).forEach((schedule) => {
        if (schedule.day !== dayName) return;
        if (!isActiveOnDate(schedule, date, subjectStartMap)) return;
        busyIntervals.push(toBusyInterval(schedule.startTime, schedule.endTime, dayEndMinutes));
      });

      (replacementByTrainerDate.get(`${trainerId}|${dateKey}`) || []).forEach((entry) => {
        busyIntervals.push(toBusyInterval(entry.startTime, entry.endTime, dayEndMinutes));
      });

      const freeIntervals = busyToAvailable(busyIntervals, dayStartMinutes, dayEndMinutes);
      const filteredSlots = clipSlotsToRange(
        freeIntervals.map((interval) => ({
          startTime: minutesToTime(interval.start),
          endTime: minutesToTime(interval.end),
        })),
        filterStartMinutes,
        filterEndMinutes
      );

      availability.push({
        date: dateKey,
        day: dayName,
        onLeave: false,
        slots: filteredSlots,
      });
    }

    trainerResults.push({
      _id: trainer._id,
      name: trainer.name,
      employeeId: trainer.employeeId,
      availability,
    });
  }

  return {
    weekStart: rangeStart,
    weekEnd: rangeEnd,
    workDayStart: WORK_DAY_START,
    workDayEnd: WORK_DAY_END,
    filterStart: minutesToTime(filterStartMinutes),
    filterEnd: minutesToTime(filterEndMinutes),
    subject: subjectMeta,
    trainers: trainerResults,
  };
};
