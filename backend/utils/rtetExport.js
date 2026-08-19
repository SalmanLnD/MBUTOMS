/**
 * RTET – Real Time Execution Tracker
 *
 * For each campus subject, for each date since the attendance tracking start,
 * sum the total hours actually executed: scheduled slots that were not cancelled
 * (by ClassCancellation), counting both original trainer slots and replacement
 * slots (internal AND external), de-duplicated so a covered slot is counted only
 * once.  Official holidays give 0 hours for that date.
 */
import Schedule from '../models/Schedule.js';
import {
  getAttendanceCalendarDates,
  getAttendanceWeekdayName,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from './attendanceDates.js';
import { getAttendanceToday } from './attendanceTracking.js';
import { getCancellationMapForRange } from './leaveAffectedClasses.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';
import { buildSubjectStartDateMap, DEFAULT_SUBJECT_START_DATE } from './subjectStartDate.js';
import { normalizeAttendanceDate } from './attendanceDates.js';
import { computeHours } from './trainerClassHours.js';
import { SUBJECT_OIF_CATALOG } from './subjectOifCatalog.js';
import Leave from '../models/Leave.js';
import { getLeaveOverlapFilter } from './leaveDateRange.js';
import { isDateWithinLeave } from './leaveDateRange.js';

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
  const rangeStart = TRAINER_ATTENDANCE_TRACKING_START;
  const rangeEnd = today;

  const dates = getAttendanceCalendarDates(rangeStart, rangeEnd);
  const dateKeys = dates.map(toAttendanceDateKey);

  const subjectCodes = RTET_SUBJECTS.map((s) => s.code);

  const [schedules, cancellationMap, holidayMap, subjectStartMap] = await Promise.all([
    Schedule.find({ subjectCode: { $in: subjectCodes } })
      .select('_id day startTime endTime subjectCode subject')
      .lean(),
    getCancellationMapForRange(rangeStart, rangeEnd),
    loadOfficialHolidayMap(rangeStart, rangeEnd),
    buildSubjectStartDateMap(),
  ]);

  // Index original schedules by subjectCode and weekday.
  const schedByCodeDay = new Map(); // code -> day -> Schedule[]
  schedules.forEach((sched) => {
    const code = sched.subjectCode?.trim();
    if (!code) return;
    if (!schedByCodeDay.has(code)) schedByCodeDay.set(code, new Map());
    const byDay = schedByCodeDay.get(code);
    if (!byDay.has(sched.day)) byDay.set(sched.day, []);
    byDay.get(sched.day).push(sched);
  });

  const scheduleIdToCode = new Map(
    schedules.map((s) => [s._id.toString(), s.subjectCode?.trim()])
  );

  // Fetch leaves whose replacements reference one of the campus subject schedules.
  const leavesWithReplacements = await Leave.find({
    status: 'approved',
    ...getLeaveOverlapFilter(rangeStart, rangeEnd),
    'replacements.0': { $exists: true },
  })
    .select('startDate endDate replacements')
    .lean();

  // For replacement schedules not already in `schedules`, fetch them once.
  const replacementSchedIds = [
    ...new Set(
      leavesWithReplacements.flatMap((leave) =>
        (leave.replacements || [])
          .map((r) => r.schedule?.toString())
          .filter(Boolean)
      )
    ),
  ].filter((id) => !scheduleIdToCode.has(id));

  const extraSchedules = replacementSchedIds.length
    ? await Schedule.find({ _id: { $in: replacementSchedIds } })
        .select('_id day startTime endTime subjectCode subject')
        .lean()
    : [];

  extraSchedules.forEach((s) => {
    const code = s.subjectCode?.trim();
    if (code) scheduleIdToCode.set(s._id.toString(), code);
  });

  const scheduleById = new Map(
    [...schedules, ...extraSchedules].map((s) => [s._id.toString(), s])
  );

  // totals[subjectIdx][dateIdx] = executed hours
  const totals = Array.from({ length: RTET_SUBJECTS.length }, () =>
    Array(dateKeys.length).fill(0)
  );
  const subjectIndexByCode = new Map(
    RTET_SUBJECTS.map((s, i) => [s.code, i])
  );

  dates.forEach((date, dateIdx) => {
    const dateKey = dateKeys[dateIdx];

    // Official holidays → 0 hours for every subject that day.
    if (holidayMap.has(dateKey)) return;

    const dayName = getAttendanceWeekdayName(date);
    const canceledIds = cancellationMap.get(dateKey) || new Set();

    // Track which original schedule slot has already been counted on this date
    // so a replacement doesn't double-count it.
    const countedSlotKeys = new Set(); // "subjectCode|startTime|endTime|section|department"

    // --- Replacement sessions (covered slots by any trainer, internal or external) ---
    leavesWithReplacements.forEach((leave) => {
      if (!isDateWithinLeave(date, leave)) return;

      (leave.replacements || []).forEach((entry) => {
        const scheduleId = entry.schedule?.toString();
        if (!scheduleId) return;
        if (canceledIds.has(scheduleId)) return;

        const sched = scheduleById.get(scheduleId);
        if (!sched || sched.day !== dayName) return;

        const code = sched.subjectCode?.trim();
        const si = subjectIndexByCode.get(code);
        if (si == null) return;

        if (!isActiveOnDate(sched, date, subjectStartMap)) return;

        // Mark the physical slot as executed (replacement can be internal or external).
        // De-dup must use the same physical "slotKey" identity as the original-slot counting
        // below, otherwise multiple replacement entries for the same slot can inflate totals.
        const slotKey = `${code}|${sched.startTime}|${sched.endTime}|${sched.section || ''}|${sched.department || ''}`;
        if (countedSlotKeys.has(slotKey)) return;
        countedSlotKeys.add(slotKey);

        totals[si][dateIdx] = Math.round(
          (totals[si][dateIdx] + computeHours(sched.startTime, sched.endTime)) * 10
        ) / 10;
      });
    });

    // --- Original (non-replaced, non-cancelled) slots ---
    RTET_SUBJECTS.forEach((subject, si) => {
      const daySchedules = schedByCodeDay.get(subject.code)?.get(dayName) || [];
      daySchedules.forEach((sched) => {
        if (canceledIds.has(sched._id.toString())) return;
        if (!isActiveOnDate(sched, date, subjectStartMap)) return;

        const slotKey = `${subject.code}|${sched.startTime}|${sched.endTime}|${sched.section || ''}|${sched.department || ''}`;
        if (countedSlotKeys.has(slotKey)) return; // already counted as replacement

        totals[si][dateIdx] = Math.round(
          (totals[si][dateIdx] + computeHours(sched.startTime, sched.endTime)) * 10
        ) / 10;
      });
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
