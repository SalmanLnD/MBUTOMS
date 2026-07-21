import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { buildTimetableBoardForDate } from './timetableBoard.js';
import {
  buildSubjectStartDateMap,
  DEFAULT_SUBJECT_START_DATE,
} from './subjectStartDate.js';
import { normalizeDate } from './scheduleHelpers.js';
import { mergeRosterFilter } from './rosterFilter.js';
import { parseTimeToMinutes } from './timetableSlots.js';
import { enrichVenueRecord } from './venueBuildingMappings.js';
import { getLeaveOverlapFilter, isDateWithinLeave, toLeaveDateKey } from './leaveDateRange.js';
import { isScheduleDayInLeaveRange } from './trainerScheduleView.js';
import { getLeaveWeekdayScheduleIds, isFullDayLeave } from './leaveScope.js';

const OPERATIONS_TIMEZONE = 'Asia/Kolkata';

/** IST calendar day, weekday name, and clock minutes for live venue matching. */
export const getIstNowParts = (dateInput = new Date()) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const dateKey = toLeaveDateKey(date);
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATIONS_TIMEZONE,
    weekday: 'long',
  }).format(date);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: OPERATIONS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  let hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  if (hour === 24) hour = 0;

  const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    dateKey,
    dayName,
    currentTime,
    minutes: hour * 60 + minute,
    asOf: date.toISOString(),
  };
};

export const isScheduleActiveAtMinutes = (schedule, minutes) => {
  if (!schedule?.startTime || !schedule?.endTime) return false;
  const start = parseTimeToMinutes(schedule.startTime);
  const end = parseTimeToMinutes(schedule.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= minutes && minutes < end;
};

const isSubjectStarted = (schedule, ref, byId, byCode) => {
  const subjectId = schedule.subject?._id?.toString() || schedule.subject?.toString();
  const subjectCode = schedule.subjectCode?.trim();
  const startDate = (subjectId && byId.get(subjectId))
    || (subjectCode && byCode.get(subjectCode))
    || DEFAULT_SUBJECT_START_DATE;
  return ref >= startDate;
};

const pickCurrentSchedule = (schedules, dayName, minutes, ref, byId, byCode) => {
  const candidates = (schedules || []).filter(
    (schedule) =>
      schedule.day === dayName
      && isSubjectStarted(schedule, ref, byId, byCode)
      && isScheduleActiveAtMinutes(schedule, minutes)
  );
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const durationA = parseTimeToMinutes(a.endTime) - parseTimeToMinutes(a.startTime);
    const durationB = parseTimeToMinutes(b.endTime) - parseTimeToMinutes(b.startTime);
    return durationB - durationA || a.startTime.localeCompare(b.startTime);
  })[0];
};

export const isTrainerOnLeaveNow = ({
  leaves = [],
  trainerId,
  trainerSchedules = [],
  referenceDate,
  dayName,
  minutes,
}) => {
  const trainerLeaves = leaves.filter(
    (leave) => leave.trainer?.toString() === trainerId
  );

  for (const leave of trainerLeaves) {
    if (!isDateWithinLeave(referenceDate, leave)) continue;
    if (!isScheduleDayInLeaveRange(dayName, leave)) continue;

    const dayScheduleIds = getLeaveWeekdayScheduleIds(leave, trainerSchedules);
    if (isFullDayLeave(leave, { dayScheduleIds })) return true;

    const affectedIds = new Set(
      (leave.affectedSchedules || []).map((id) => id?.toString?.() || String(id))
    );
    const activeLeaveSlot = trainerSchedules.some(
      (schedule) =>
        schedule.day === dayName
        && affectedIds.has(schedule._id.toString())
        && isScheduleActiveAtMinutes(schedule, minutes)
    );
    if (activeLeaveSlot) return true;
  }

  return false;
};

export const buildReplacementByScheduleMap = (leaves = [], trainerById = new Map()) => {
  const map = new Map();
  leaves.forEach((leave) => {
    (leave.replacements || []).forEach((replacement) => {
      const scheduleId = replacement.schedule?.toString();
      if (!scheduleId) return;

      if (replacement.isExternal && replacement.externalTrainerName) {
        map.set(scheduleId, {
          isExternal: true,
          name: replacement.externalTrainerName.trim(),
          trainerId: null,
          employeeId: null,
        });
        return;
      }

      const replacementTrainerId = replacement.replacementTrainer?.toString();
      const trainer = replacementTrainerId ? trainerById.get(replacementTrainerId) : null;
      if (!trainer) return;

      map.set(scheduleId, {
        isExternal: false,
        name: trainer.name,
        trainerId: trainer._id?.toString() || replacementTrainerId,
        employeeId: trainer.employeeId || '',
      });
    });
  });
  return map;
};

const serializeVenue = (venue) => {
  if (!venue) return null;
  const enriched = enrichVenueRecord(venue);
  return {
    _id: enriched._id,
    name: enriched.name,
    building: enriched.building,
    floor: enriched.floor,
    displayBuilding: enriched.displayBuilding,
    displayFloor: enriched.displayFloor,
    locationSummary: enriched.locationSummary,
  };
};

const serializeSchedule = (schedule) => {
  if (!schedule) return null;
  return {
    _id: schedule._id,
    day: schedule.day,
    slot: schedule.slot || '',
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    department: schedule.department || '',
    section: schedule.section || '',
    subjectCode: schedule.subjectCode || '',
    isLab: Boolean(schedule.isLab),
    isProject: Boolean(schedule.isProject),
    isReplacementAssignment: Boolean(schedule.isReplacementAssignment),
    replacementFor: schedule.replacementFor || null,
    isExternal: Boolean(schedule.isExternal),
    externalTrainerName: schedule.externalTrainerName || '',
  };
};

const buildTrainerLiveRow = ({
  trainerId = null,
  employeeId = null,
  name,
  isExternal = false,
  status = 'free',
  current = null,
  replacedTrainerName = '',
}) => {
  if (!current) {
    return {
      trainerId,
      employeeId,
      name,
      isExternal,
      status,
      venue: null,
      schedule: null,
      replacedTrainerName: replacedTrainerName || '',
    };
  }

  const venue = serializeVenue(current.venue);
  return {
    trainerId,
    employeeId,
    name,
    isExternal,
    status: venue ? 'in_class' : 'in_class_no_venue',
    venue,
    schedule: serializeSchedule(current),
    replacedTrainerName: replacedTrainerName || '',
  };
};

const resolveRosterTrainerRow = ({
  trainer,
  boardSchedules,
  clock,
  ref,
  byId,
  byCode,
  replacementBySchedule,
  leaves,
}) => {
  const ownedSchedules = boardSchedules.filter((schedule) => !schedule.isReplacementAssignment);
  const coveringSchedules = boardSchedules.filter((schedule) => schedule.isReplacementAssignment);
  const onLeaveNow = isTrainerOnLeaveNow({
    leaves,
    trainerId: trainer._id.toString(),
    trainerSchedules: ownedSchedules,
    referenceDate: ref,
    dayName: clock.dayName,
    minutes: clock.minutes,
  });

  const currentCovering = pickCurrentSchedule(
    coveringSchedules,
    clock.dayName,
    clock.minutes,
    ref,
    byId,
    byCode
  );
  if (currentCovering) {
    return buildTrainerLiveRow({
      trainerId: trainer._id,
      employeeId: trainer.employeeId,
      name: trainer.name,
      current: currentCovering,
    });
  }

  const currentOwned = pickCurrentSchedule(
    ownedSchedules,
    clock.dayName,
    clock.minutes,
    ref,
    byId,
    byCode
  );

  if (currentOwned) {
    const scheduleId = currentOwned._id.toString();
    const replacement = replacementBySchedule.get(scheduleId);
    if (replacement) {
      return buildTrainerLiveRow({
        trainerId: replacement.trainerId,
        employeeId: replacement.employeeId,
        name: replacement.name,
        isExternal: replacement.isExternal,
        current: currentOwned,
        replacedTrainerName: trainer.name,
      });
    }
    if (onLeaveNow) {
      return buildTrainerLiveRow({
        trainerId: trainer._id,
        employeeId: trainer.employeeId,
        name: trainer.name,
        status: 'not_available',
      });
    }

    return buildTrainerLiveRow({
      trainerId: trainer._id,
      employeeId: trainer.employeeId,
      name: trainer.name,
      current: currentOwned,
    });
  }

  return buildTrainerLiveRow({
    trainerId: trainer._id,
    employeeId: trainer.employeeId,
    name: trainer.name,
    status: onLeaveNow ? 'not_available' : 'free',
  });
};

/**
 * Trainer-wise current venue from today's schedule at the current IST time.
 * Reuses the timetable board (owned + replacement classes, cancellations).
 */
export const buildLiveTrainerVenues = async ({ now = new Date() } = {}) => {
  const clock = getIstNowParts(now);
  const referenceDate = clock.dateKey
    ? new Date(`${clock.dateKey}T12:00:00+05:30`)
    : now;

  const rosterFilter = await mergeRosterFilter({}, { rosterOnly: true });
  const [{ schedulesByTrainer }, trainers, subjectStarts] = await Promise.all([
    buildTimetableBoardForDate({ referenceDate }),
    Trainer.find(rosterFilter)
      .select('name employeeId')
      .sort({ employeeId: 1 })
      .lean(),
    buildSubjectStartDateMap(),
  ]);

  const trainerIds = trainers.map((trainer) => trainer._id);
  const trainerById = new Map(trainers.map((trainer) => [trainer._id.toString(), trainer]));
  const ref = normalizeDate(referenceDate);
  const { byId, byCode } = subjectStarts;

  const leaves = trainerIds.length
    ? await Leave.find({
      status: 'approved',
      trainer: { $in: trainerIds },
      ...getLeaveOverlapFilter(referenceDate),
    })
      .select('trainer startDate endDate scope reason affectedSchedules replacements')
      .populate('replacements.replacementTrainer', 'name employeeId')
      .lean()
    : [];

  const replacementLeaves = await Leave.find({
    status: 'approved',
    ...getLeaveOverlapFilter(referenceDate),
    'replacements.0': { $exists: true },
  })
    .select('replacements')
    .populate('replacements.replacementTrainer', 'name employeeId')
    .lean();

  const allTrainersForReplacement = await Trainer.find()
    .select('name employeeId')
    .lean();
  allTrainersForReplacement.forEach((trainer) => {
    trainerById.set(trainer._id.toString(), trainer);
  });

  const replacementBySchedule = buildReplacementByScheduleMap(
    replacementLeaves,
    trainerById
  );

  const rows = trainers.map((trainer) => resolveRosterTrainerRow({
    trainer,
    boardSchedules: schedulesByTrainer[trainer.employeeId] || [],
    clock,
    ref,
    byId,
    byCode,
    replacementBySchedule,
    leaves,
  }));

  const representedScheduleIds = new Set(
    rows.map((row) => row.schedule?._id).filter(Boolean)
  );

  const externalKeys = Object.keys(schedulesByTrainer)
    .filter((key) => key.startsWith('external:'))
    .sort((a, b) => a.localeCompare(b));

  externalKeys.forEach((key) => {
    const boardSchedules = schedulesByTrainer[key] || [];
    const hasToday = boardSchedules.some(
      (schedule) =>
        schedule.day === clock.dayName
        && isSubjectStarted(schedule, ref, byId, byCode)
    );
    if (!hasToday) return;

    const current = pickCurrentSchedule(
      boardSchedules,
      clock.dayName,
      clock.minutes,
      ref,
      byId,
      byCode
    );
    if (current && representedScheduleIds.has(current._id.toString())) return;

    const name = current?.externalTrainerName
      || boardSchedules.find((schedule) => schedule.externalTrainerName)?.externalTrainerName
      || key.slice('external:'.length);

    rows.push(buildTrainerLiveRow({
      name,
      isExternal: true,
      current,
    }));
  });

  return {
    asOf: clock.asOf,
    date: clock.dateKey,
    day: clock.dayName,
    currentTime: clock.currentTime,
    trainers: rows,
  };
};
