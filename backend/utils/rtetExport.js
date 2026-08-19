/**
 * RTET – Real Time Execution Tracker (baseline mode)
 *
 * Baseline mode intentionally uses ONLY timetable schedules:
 * - ignore cancellations
 * - ignore replacements/interventions
 * - apply official holidays (0 hours)
 * - apply only subject start dates
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
import { buildSubjectStartDateMap, DEFAULT_SUBJECT_START_DATE } from './subjectStartDate.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';

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

const isActiveOnDate = (schedule, date, subjectStartMap) => {
  const ref = normalizeAttendanceDate(date);
  const subjectId = schedule.subject?.toString();
  const subjectCode = schedule.subjectCode?.trim();
  let start = null;
  if (subjectId && subjectStartMap.byId.has(subjectId)) {
    start = subjectStartMap.byId.get(subjectId);
  } else if (subjectCode && subjectStartMap.byCode.has(subjectCode)) {
    start = subjectStartMap.byCode.get(subjectCode);
  }
  return ref >= (start ?? DEFAULT_SUBJECT_START_DATE);
};

export const buildRtetExportPayload = async () => {
  const today = getAttendanceToday();
  const subjectCodes = RTET_SUBJECTS.map((s) => s.code);
  const subjectStartMap = await buildSubjectStartDateMap();

  // Show RTET only from the earliest subject start date (fallback 13 Jul 2026).
  const subjectStartCandidates = RTET_SUBJECTS.map((subject) =>
    subjectStartMap.byCode.get(subject.code) || DEFAULT_SUBJECT_START_DATE
  );
  const earliestSubjectStart = subjectStartCandidates.reduce(
    (min, date) => (date < min ? date : min),
    DEFAULT_SUBJECT_START_DATE
  );
  const rangeStart = earliestSubjectStart > TRAINER_ATTENDANCE_TRACKING_START
    ? earliestSubjectStart
    : TRAINER_ATTENDANCE_TRACKING_START;
  const rangeEnd = today;

  const dates = getAttendanceCalendarDates(rangeStart, rangeEnd);
  const dateKeys = dates.map(toAttendanceDateKey);

  const [schedules, holidayMap] = await Promise.all([
    Schedule.find({ subjectCode: { $in: subjectCodes } })
      .select('_id day startTime endTime subjectCode section department subject')
      .lean(),
    loadOfficialHolidayMap(rangeStart, rangeEnd),
  ]);

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
      schedule: sched,
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
    const dateKey = dateKeys[dateIdx];
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
        if (!isActiveOnDate(slot.schedule, date, subjectStartMap)) return sum;
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

  // Group by physical slot identity (same identity as RTET baseline de-dupe).
  const slotMap = new Map(); // slotKey -> {slot details}

  daySchedules.forEach((sched) => {
    if (!isActiveOnDate(sched, day, subjectStartMap)) return;
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
