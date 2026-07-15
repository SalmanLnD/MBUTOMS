import { toLeaveDateKey } from './leaveDateRange.js';

export const LEAVE_SCOPES = {
  FULL_DAY: 'full_day',
  SLOT: 'slot',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getLeaveWeekdays = (leave) => {
  const startKey = toLeaveDateKey(leave?.startDate);
  const endKey = toLeaveDateKey(leave?.endDate);
  if (!startKey || !endKey) return [];

  const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
  const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12));
  const days = new Set();

  while (cursor <= end) {
    days.add(WEEKDAYS[cursor.getUTCDay()]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return [...days];
};

export const resolveLeaveScope = (leave, { dayScheduleIds = null } = {}) => {
  if (leave?.scope === LEAVE_SCOPES.SLOT) return LEAVE_SCOPES.SLOT;
  if (leave?.scope === LEAVE_SCOPES.FULL_DAY) return LEAVE_SCOPES.FULL_DAY;

  // Compatibility for slot requests created before the scope field existed.
  if (leave?.reason === 'Ad-hoc slot replacement') return LEAVE_SCOPES.SLOT;

  // Legacy leaves: only treat as full-day when every timetable slot on the
  // leave weekdays is listed in affectedSchedules (e.g. Divya's one-slot
  // "sick" leave must not wipe a whole Wednesday).
  if (Array.isArray(dayScheduleIds)) {
    if (!dayScheduleIds.length) return LEAVE_SCOPES.FULL_DAY;
    const affected = new Set(
      (leave?.affectedSchedules || []).map((id) => id?._id?.toString?.() || String(id))
    );
    const coversAll = dayScheduleIds.every((id) => affected.has(String(id)));
    return coversAll ? LEAVE_SCOPES.FULL_DAY : LEAVE_SCOPES.SLOT;
  }

  // Without schedule context, do not assume full-day for legacy rows.
  return LEAVE_SCOPES.SLOT;
};

export const isFullDayLeave = (leave, options) =>
  resolveLeaveScope(leave, options) === LEAVE_SCOPES.FULL_DAY;

export const getLeaveWeekdayScheduleIds = (leave, trainerSchedules = []) => {
  const weekdays = new Set(getLeaveWeekdays(leave));
  return trainerSchedules
    .filter((schedule) => weekdays.has(schedule.day))
    .map((schedule) => schedule._id.toString());
};
