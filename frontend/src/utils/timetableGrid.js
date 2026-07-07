import { formatTimeRange } from './scheduleUtils.js';
import {
  getSubjectSlotDefinitions,
  getDefaultSlotDefinitions,
  getPeriodOnlySlotDefinitions,
  matchScheduleToSlot,
} from './timetableSlots.js';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_SHORT_LABELS = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
};

export const formatDayShort = (day) => DAY_SHORT_LABELS[day] || day;

const slotKey = (startTime, endTime) => `${startTime}|${endTime}`;

const getColumnKey = (slot, periodOnly) =>
  periodOnly ? slot.key : slotKey(slot.startTime, slot.endTime);

const resolveSlotDefinitions = (fixedSlots, periodOnlyMode) => {
  if (fixedSlots?.length) return fixedSlots;
  return periodOnlyMode ? getPeriodOnlySlotDefinitions() : getDefaultSlotDefinitions();
};

export const buildTimetableGrid = (
  schedules,
  days = WEEKDAYS,
  fixedSlots = null,
  { periodOnlyMode = false } = {}
) => {
  const periodOnly = Boolean(
    periodOnlyMode
    || (fixedSlots?.length && fixedSlots.every((slot) => slot.periodOnly))
  );
  const slotDefinitions = resolveSlotDefinitions(fixedSlots, periodOnly);
  const timeSlots = slotDefinitions.map((slot) => ({
    ...slot,
    headerLabel: slot.key || null,
    subLabel: periodOnly ? '' : (slot.label || formatTimeRange(slot.startTime, slot.endTime)),
    periodOnly,
  }));

  const cells = {};

  schedules.forEach((schedule) => {
    const matchedSlot = matchScheduleToSlot(schedule, slotDefinitions);
    if (!matchedSlot) return;

    const columnKey = getColumnKey(matchedSlot, periodOnly);
    const key = `${schedule.day}|${columnKey}`;
    cells[key] = schedule;
  });

  return { days, timeSlots, cells, periodOnly };
};

export const getUniqueTrainerCodes = (schedules) =>
  [...new Set(schedules.map((s) => s.trainerCode))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

export const buildFixedSlotsForSubject = (subject) =>
  subject ? getSubjectSlotDefinitions(subject) : getDefaultSlotDefinitions();

/**
 * Pick grid columns for a trainer row on the timetable board.
 * Uses the subject filter when set; otherwise derives columns from the trainer's
 * scheduled subject(s). Falls back to period-only mode when timings differ.
 */
export const resolveTrainerGridSlots = ({
  selectedSubject,
  trainerSubjects,
  visibleSchedules,
  showTimingsInCells,
}) => {
  if (showTimingsInCells) return null;

  if (selectedSubject) {
    return buildFixedSlotsForSubject(selectedSubject);
  }

  if (trainerSubjects.length === 1) {
    return buildFixedSlotsForSubject(trainerSubjects[0]);
  }

  if (trainerSubjects.length > 1) {
    return null;
  }

  if (!visibleSchedules.length) {
    return getDefaultSlotDefinitions();
  }

  return null;
};
