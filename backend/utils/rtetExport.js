/**
 * RTET – Real Time Execution Tracker (baseline mode)
 *
 * Baseline mode uses the main timetable as its source of truth:
 * - exclude cancelled timetable occurrences
 * - ignore replacement-trainer ownership changes
 * - apply official holidays (0 hours)
 * - respect subject start and end dates
 *
 * This yields the same recurring weekly pattern for each weekday.
 */
import Schedule from '../models/Schedule.js';
import {
  getAttendanceCalendarDates,
  getAttendanceWeekdayName,
  normalizeAttendanceDate,
  toAttendanceDateKey,
} from './attendanceDates.js';
import { getAttendanceToday } from './attendanceTracking.js';
import { computeHours } from './trainerClassHours.js';
import { SUBJECT_OIF_CATALOG } from './subjectOifCatalog.js';
import {
  buildSubjectStartDateMap,
  DEFAULT_SUBJECT_START_DATE,
} from './subjectStartDate.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';
import { getCancellationMapForRange } from './leaveAffectedClasses.js';

/** The campus subjects in the fixed RTET display order. */
export const RTET_SUBJECTS = SUBJECT_OIF_CATALOG.map((entry) => ({
  code: entry.code,
  name: entry.name,
  oifNumber: entry.oifNumber,
}));

/** Keep the RTET date axis stable for formulas in linked worksheets. */
export const RTET_TRACKING_START = new Date(Date.UTC(2026, 6, 12));

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

const getSubjectRange = (schedule, subjectStartMap) => {
  const subjectId = schedule.subject?._id?.toString() || schedule.subject?.toString();
  const subjectCode = schedule.subjectCode?.trim();
  const cached = (subjectId && subjectStartMap.byId.get(subjectId))
    || (subjectCode && subjectStartMap.byCode.get(subjectCode));
  // Support both the historical Date cache and the current
  // { startDate, endDate } cache contract during rolling deployments.
  if (cached instanceof Date) return { startDate: cached, endDate: null };
  return {
    startDate: cached?.startDate || DEFAULT_SUBJECT_START_DATE,
    endDate: cached?.endDate || null,
  };
};

export const isRtetScheduleActiveOnDate = (schedule, date, subjectStartMap) => {
  const ref = normalizeAttendanceDate(date);
  const { startDate, endDate } = getSubjectRange(schedule, subjectStartMap);
  return ref >= startDate && (!endDate || ref <= endDate);
};

export const getRtetRangeStart = () => new Date(RTET_TRACKING_START);

export const buildRtetExportPayload = async () => {
  const today = getAttendanceToday();
  const subjectCodes = RTET_SUBJECTS.map((s) => s.code);
  const subjectStartMap = await buildSubjectStartDateMap();

  // Keep 12 Jul 2026 in column B. Subject start dates still make pre-start
  // occurrences zero without shifting columns used by dependent formulas.
  const rangeStart = getRtetRangeStart();
  const rangeEnd = today;

  const dates = getAttendanceCalendarDates(rangeStart, rangeEnd);
  const dateKeys = dates.map(toAttendanceDateKey);

  const [schedules, holidayMap, cancellationMap] = await Promise.all([
    Schedule.find({ subjectCode: { $in: subjectCodes } })
      .select('_id day startTime endTime subjectCode section department subject')
      .lean(),
    loadOfficialHolidayMap(rangeStart, rangeEnd),
    getCancellationMapForRange(rangeStart, rangeEnd),
  ]);

  // Index schedules by subjectCode and weekday, deduping physical slot identity.
  const schedByCodeDay = new Map(); // code -> day -> slotKey -> slot
  schedules.forEach((sched) => {
    const code = sched.subjectCode?.trim();
    if (!code) return;
    if (!schedByCodeDay.has(code)) schedByCodeDay.set(code, new Map());
    const byDay = schedByCodeDay.get(code);
    if (!byDay.has(sched.day)) byDay.set(sched.day, new Map());
    const daySlots = byDay.get(sched.day);
    const slotKey = buildSlotKey(sched, code);
    if (!daySlots.has(slotKey)) {
      daySlots.set(slotKey, {
        slotKey,
        hours: computeHours(sched.startTime, sched.endTime),
        startTime: sched.startTime,
        endTime: sched.endTime,
        section: sched.section || '',
        department: sched.department || '',
        schedules: [],
      });
    }
    daySlots.get(slotKey).schedules.push(sched);
  });

  // totals[subjectIdx][dateIdx] = executed hours
  const totals = Array.from({ length: RTET_SUBJECTS.length }, () =>
    Array(dateKeys.length).fill(0)
  );
  const subjectIndexByCode = new Map(
    RTET_SUBJECTS.map((s, i) => [s.code, i])
  );

  dates.forEach((date, dateIdx) => {
    const dateKey = dateKeys[dateIdx];
    const canceledIds = cancellationMap.get(dateKey) || new Set();
    if (holidayMap.has(dateKey)) {
      subjectIndexByCode.forEach((si) => {
        totals[si][dateIdx] = 0;
      });
      return;
    }
    const dayName = getAttendanceWeekdayName(date);
    subjectIndexByCode.forEach((si, code) => {
      const daySlots = schedByCodeDay.get(code)?.get(dayName);
      if (!daySlots) {
        totals[si][dateIdx] = 0;
        return;
      }
      const hours = [...daySlots.values()].reduce((sum, slot) => {
        const hasActiveOccurrence = slot.schedules.some((schedule) =>
          isRtetScheduleActiveOnDate(schedule, date, subjectStartMap)
        );
        if (!hasActiveOccurrence) return sum;
        const allCanceled = slot.schedules.every((schedule) =>
          canceledIds.has(schedule._id.toString())
        );
        if (allCanceled) return sum;
        return sum + Number(slot.hours || 0);
      }, 0);
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
  const subjectStartMap = await buildSubjectStartDateMap();
  const cancellationMap = await getCancellationMapForRange(day, day);
  const canceledIds = cancellationMap.get(dateKey) || new Set();

  // Group by physical slot identity (same identity as RTET baseline de-dupe).
  const slotMap = new Map(); // slotKey -> {slot details}

  daySchedules.forEach((sched) => {
    if (!isRtetScheduleActiveOnDate(sched, day, subjectStartMap)) return;
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
        schedule: sched,
        scheduleIds: [],
      });
    }

    slotMap.get(slotKey).scheduleIds.push({ id: sched._id.toString() });
  });

  const physicalSlots = [];
  let executedHours = 0;

  for (const slot of slotMap.values()) {
    const allCanceled = slot.scheduleIds.every((row) => canceledIds.has(row.id));
    if (!allCanceled) {
      executedHours += slot.hours;
    }

    physicalSlots.push({
      slotKey: slot.slotKey,
      startTime: slot.startTime,
      endTime: slot.endTime,
      section: slot.section,
      department: slot.department,
      hours: slot.hours,
      canceled: allCanceled,
      scheduleIds: slot.scheduleIds,
    });
  }

  // Sort by start time for readability.
  physicalSlots.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  executedHours = Math.round(executedHours * 10) / 10;

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
