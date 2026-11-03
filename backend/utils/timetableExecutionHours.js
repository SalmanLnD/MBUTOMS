import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceTracking.js';
import { isScheduleWithinSubjectDates } from './subjectStartDate.js';
import { getWeekdayForDateKey, isSpecialScheduleActiveOnDate } from './specialClass.js';

export const TIMETABLE_EXECUTION_START = '2026-07-13';

const slotMinutes = (startTime, endTime) => {
  const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!clockPattern.test(startTime || '') || !clockPattern.test(endTime || '')) return 0;
  const [startHour, startMinute] = String(startTime || '').split(':').map(Number);
  const [endHour, endMinute] = String(endTime || '').split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  return Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
};

const toHours = (minutes) => Math.round((minutes / 60) * 100) / 100;

const hoursFromParts = (scheduledMinutes, cancelledMinutes, executedMinutes) => {
  const scheduledHours = toHours(scheduledMinutes);
  const cancelledHours = toHours(cancelledMinutes);
  const executedHours = toHours(executedMinutes);
  const pendingHours = toHours(Math.max(0, scheduledMinutes - cancelledMinutes - executedMinutes));
  const executionPercent = scheduledHours > 0
    ? Math.round((executedHours / scheduledHours) * 1000) / 10
    : 0;
  return { scheduledHours, cancelledHours, executedHours, pendingHours, executionPercent };
};

const dateKeysBetween = (fromKey, toKey) => {
  const cursor = normalizeAttendanceDate(fromKey);
  const end = normalizeAttendanceDate(toKey);
  const keys = [];
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || end < cursor) return keys;
  while (cursor <= end) {
    keys.push(toAttendanceDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
};

const finishRow = ({ scheduledMinutes, cancelledMinutes, executedMinutes, ...row }) => ({
  ...row,
  ...hoursFromParts(scheduledMinutes, cancelledMinutes, executedMinutes),
});

/**
 * Scheduled hours are timetable slots from 13 July through today, excluding official holidays.
 * A cancelled class was on the timetable, so its hours stay in scheduled and come out of executed.
 */
export const summarizeTimetableExecution = ({
  schedules = [],
  holidayDates = new Set(),
  canceledByDate = new Map(),
  completedByDate = new Map(),
  now = new Date(),
  subjectMap,
  fromKey = TIMETABLE_EXECUTION_START,
  toKey,
}) => {
  const byDay = new Map();
  schedules.forEach((schedule) => {
    const day = schedule.day;
    if (!day) return;
    const list = byDay.get(day) || [];
    list.push(schedule);
    byDay.set(day, list);
  });

  const subjects = new Map();
  const classes = new Map();
  let scheduledMinutes = 0;
  let cancelledMinutes = 0;
  let executedMinutes = 0;

  dateKeysBetween(fromKey, toKey).forEach((dateKey) => {
    if (holidayDates.has(dateKey)) return;
    const daySchedules = byDay.get(getWeekdayForDateKey(dateKey)) || [];
    const canceled = canceledByDate.get(dateKey) || new Set();
    const completed = completedByDate.get(dateKey) || new Set();
    const date = normalizeAttendanceDate(dateKey);

    daySchedules.forEach((schedule) => {
      if (!isSpecialScheduleActiveOnDate(schedule, date)) return;
      if (!isScheduleWithinSubjectDates(schedule, date, subjectMap)) return;
      const minutes = slotMinutes(schedule.startTime, schedule.endTime);
      if (!minutes) return;

      const cancelled = canceled.has(String(schedule._id));
      const end = /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.endTime || '')
        ? new Date(`${dateKey}T${schedule.endTime}:00+05:30`) : null;
      const executed = !cancelled && completed.has(String(schedule._id)) && end && end <= now;
      scheduledMinutes += minutes;
      if (cancelled) cancelledMinutes += minutes;
      if (executed) executedMinutes += minutes;

      const subject = schedule.subject && typeof schedule.subject === 'object' ? schedule.subject : null;
      const subjectCode = String(subject?.code || schedule.subjectCode || '').trim();
      const subjectName = String(subject?.name || subjectCode || 'Unassigned subject').trim();
      const subjectKey = String(subject?._id || schedule.subject || subjectCode || subjectName);
      const subjectRow = subjects.get(subjectKey) || {
        subjectId: subject?._id || schedule.subject || '',
        subjectCode,
        subjectName,
        scheduledMinutes: 0,
        cancelledMinutes: 0,
        executedMinutes: 0,
      };
      subjectRow.scheduledMinutes += minutes;
      if (cancelled) subjectRow.cancelledMinutes += minutes;
      if (executed) subjectRow.executedMinutes += minutes;
      subjects.set(subjectKey, subjectRow);

      const department = String(schedule.department || '').trim();
      const section = String(schedule.section || '').trim();
      const classLabel = [department, section].filter(Boolean).join(' ') || 'Unassigned class';
      const classRow = classes.get(classLabel) || {
        classLabel,
        department,
        section,
        scheduledMinutes: 0,
        cancelledMinutes: 0,
        executedMinutes: 0,
      };
      classRow.scheduledMinutes += minutes;
      if (cancelled) classRow.cancelledMinutes += minutes;
      if (executed) classRow.executedMinutes += minutes;
      classes.set(classLabel, classRow);
    });
  });

  return {
    from: fromKey,
    to: toKey,
    subjects: [...subjects.values()].map(finishRow).sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    classes: [...classes.values()].map(finishRow).sort((a, b) => a.classLabel.localeCompare(b.classLabel)),
    totals: hoursFromParts(scheduledMinutes, cancelledMinutes, executedMinutes),
  };
};
