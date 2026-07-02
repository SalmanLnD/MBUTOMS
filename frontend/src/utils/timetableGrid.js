import { formatTimeRange } from './scheduleUtils.js';
import {
  getSubjectSlotDefinitions,
  getDefaultSlotDefinitions,
  getPeriodOnlySlotDefinitions,
  matchScheduleToSlot,
} from './timetableSlots.js';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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
