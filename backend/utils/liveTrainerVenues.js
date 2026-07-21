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
import { toLeaveDateKey } from './leaveDateRange.js';

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
  // Prefer the longest-running slot if overlapping data exists.
  return [...candidates].sort((a, b) => {
    const durationA = parseTimeToMinutes(a.endTime) - parseTimeToMinutes(a.startTime);
    const durationB = parseTimeToMinutes(b.endTime) - parseTimeToMinutes(b.startTime);
    return durationB - durationA || a.startTime.localeCompare(b.startTime);
  })[0];
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
  current,
}) => {
  if (!current) {
    return {
      trainerId,
      employeeId,
      name,
      isExternal,
      status: 'free',
      venue: null,
      schedule: null,
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
  };
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

  const ref = normalizeDate(referenceDate);
  const { byId, byCode } = subjectStarts;

  const rows = trainers.map((trainer) => {
    const boardSchedules = schedulesByTrainer[trainer.employeeId] || [];
    const current = pickCurrentSchedule(
      boardSchedules,
      clock.dayName,
      clock.minutes,
      ref,
      byId,
      byCode
    );

    return buildTrainerLiveRow({
      trainerId: trainer._id,
      employeeId: trainer.employeeId,
      name: trainer.name,
      current,
    });
  });

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
