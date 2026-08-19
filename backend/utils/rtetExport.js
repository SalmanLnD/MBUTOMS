/**
 * RTET – Real Time Execution Tracker (baseline mode)
 *
 * Baseline mode intentionally uses ONLY timetable schedules:
 * - ignore cancellations
 * - ignore replacements/interventions
 * - ignore holidays
 * - ignore subject start dates
 *
 * This yields the same recurring weekly pattern for each weekday.
 */
import Schedule from '../models/Schedule.js';
import {
  getAttendanceCalendarDates,
  getAttendanceWeekdayName,
  normalizeAttendanceDate,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from './attendanceDates.js';
import { getAttendanceToday } from './attendanceTracking.js';
import { computeHours } from './trainerClassHours.js';
import { SUBJECT_OIF_CATALOG } from './subjectOifCatalog.js';

/** The campus subjects in the fixed RTET display order. */
export const RTET_SUBJECTS = SUBJECT_OIF_CATALOG.map((entry) => ({
  code: entry.code,
  name: entry.name,
  oifNumber: entry.oifNumber,
}));

const formatDateLabel = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

const buildSlotKey = (schedule, codeOverride) =>
  `${codeOverride || schedule.subjectCode || ''}|${schedule.startTime}|${schedule.endTime}|${schedule.section || ''}|${schedule.department || ''}`;

export const buildRtetExportPayload = async () => {
  const today = getAttendanceToday();
  const rangeStart = TRAINER_ATTENDANCE_TRACKING_START;
  const rangeEnd = today;

  const dates = getAttendanceCalendarDates(rangeStart, rangeEnd);
  const dateKeys = dates.map(toAttendanceDateKey);

  const subjectCodes = RTET_SUBJECTS.map((s) => s.code);

  const schedules = await Schedule.find({ subjectCode: { $in: subjectCodes } })
    .select('_id day startTime endTime subjectCode section department')
    .lean();

  // Index schedules by subjectCode and weekday, deduping physical slot identity.
  const schedByCodeDay = new Map(); // code -> day -> [{hours, slotKey}]
  schedules.forEach((sched) => {
    const code = sched.subjectCode?.trim();
    if (!code) return;
    if (!schedByCodeDay.has(code)) schedByCodeDay.set(code, new Map());
    const byDay = schedByCodeDay.get(code);
    if (!byDay.has(sched.day)) byDay.set(sched.day, new Map());
    const daySlots = byDay.get(sched.day);
    const slotKey = buildSlotKey(sched, code);
    if (daySlots.has(slotKey)) return;
    daySlots.set(slotKey, {
      slotKey,
      hours: computeHours(sched.startTime, sched.endTime),
      startTime: sched.startTime,
      endTime: sched.endTime,
      section: sched.section || '',
      department: sched.department || '',
    });
  });

  // totals[subjectIdx][dateIdx] = executed hours
  const totals = Array.from({ length: RTET_SUBJECTS.length }, () =>
    Array(dateKeys.length).fill(0)
  );
  const subjectIndexByCode = new Map(
    RTET_SUBJECTS.map((s, i) => [s.code, i])
  );

  dates.forEach((date, dateIdx) => {
    const dayName = getAttendanceWeekdayName(date);
    subjectIndexByCode.forEach((si, code) => {
      const daySlots = schedByCodeDay.get(code)?.get(dayName);
      if (!daySlots) {
        totals[si][dateIdx] = 0;
        return;
      }
      const hours = [...daySlots.values()].reduce((sum, slot) => sum + Number(slot.hours || 0), 0);
      totals[si][dateIdx] = Math.round(hours * 10) / 10;
    });
  });

  return {
    dateLabels: dateKeys.map(formatDateLabel),
    subjects: RTET_SUBJECTS.map((s, si) => ({
      name: s.name,
      oifNumber: s.oifNumber,
      hours: totals[si],
    })),
  };
};

/** Debug helper: explain baseline RTET hours for one subject/date using schedules only. */
export const buildRtetDebugForSubjectDate = async ({ subjectCode, dateInput } = {}) => {
  const code = String(subjectCode || '').trim();
  if (!code) return { message: 'subjectCode is required' };

  const day = normalizeAttendanceDate(dateInput || new Date());
  const dateKey = toAttendanceDateKey(day);
  const dayName = getAttendanceWeekdayName(day);

  const schedules = await Schedule.find({ subjectCode: code })
    .select('_id day startTime endTime department section subjectCode')
    .lean();

  const daySchedules = schedules.filter((sched) => sched.day === dayName);

  // Group by physical slot identity (same identity as RTET baseline de-dupe).
  const slotMap = new Map(); // slotKey -> {slot details}

  daySchedules.forEach((sched) => {
    const slotKey = buildSlotKey(sched, code);
    const hours = computeHours(sched.startTime, sched.endTime);

    if (!slotMap.has(slotKey)) {
      slotMap.set(slotKey, {
        slotKey,
        startTime: sched.startTime,
        endTime: sched.endTime,
        section: sched.section || '',
        department: sched.department || '',
        hours,
        scheduleIds: [],
      });
    }

    slotMap.get(slotKey).scheduleIds.push({ id: sched._id.toString() });
  });

  const physicalSlots = [];
  let executedHours = 0;

  for (const slot of slotMap.values()) {
    executedHours = Math.round((executedHours + slot.hours) * 10) / 10;

    physicalSlots.push({
      slotKey: slot.slotKey,
      startTime: slot.startTime,
      endTime: slot.endTime,
      section: slot.section,
      department: slot.department,
      hours: slot.hours,
      scheduleIds: slot.scheduleIds,
    });
  }

  // Sort by start time for readability.
  physicalSlots.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

  return {
    subjectCode: code,
    subjectCodeName: RTET_SUBJECTS.find((s) => s.code === code)?.name || '',
    dateKey,
    dayName,
    executedHours,
    mode: 'baseline_schedule_only',
    physicalSlots,
  };
};
