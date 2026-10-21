import Subject from '../models/Subject.js';
import { normalizeAttendanceDate as normalizeDate } from './attendanceTracking.js';
import { createAsyncReportCache } from './asyncReportCache.js';
import { invalidateDerivedData } from './dataRevision.js';
import { resolveSubjectEndDate } from './subjectTrainingDates.js';
export { resolveSubjectEndDate } from './subjectTrainingDates.js';

/** Fallback when a schedule slot is not linked to a subject record. */
export const DEFAULT_SUBJECT_START_DATE = new Date(Date.UTC(2026, 6, 13));
export const DEFAULT_SUBJECT_END_DATE = new Date(Date.UTC(2026, 10, 6));

const readSubjectMap = createAsyncReportCache({ ttlMs: 60_000, maxEntries: 1 });
export const buildSubjectStartDateMap = () => readSubjectMap('subjects', async () => {
  const subjects = await Subject.find().select('_id code name startDate endDate').lean();
  const byId = new Map();
  const byCode = new Map();
  for (const subject of subjects) {
    const range = {
      startDate: subject.startDate ? normalizeDate(subject.startDate) : DEFAULT_SUBJECT_START_DATE,
      endDate: resolveSubjectEndDate(subject) || DEFAULT_SUBJECT_END_DATE,
    };
    byId.set(String(subject._id), range);
    if (subject.code) byCode.set(subject.code.trim(), range);
  }
  return { byId, byCode };
});
export const clearSubjectStartDateCache = invalidateDerivedData;

export const getScheduleSubjectRange = (schedule, map) => {
  if (schedule?.isSpecial && schedule.specialStartDate) {
    return {
      startDate: normalizeDate(schedule.specialStartDate),
      endDate: normalizeDate(schedule.specialEndDate || schedule.specialStartDate),
    };
  }
  const id = schedule.subject?._id?.toString() || schedule.subject?.toString();
  const code = String(schedule.subjectCode || schedule.subject?.code || '').trim();
  const meta = map.byId.get(id) || map.byCode.get(code);
  return {
    startDate: meta?.startDate || DEFAULT_SUBJECT_START_DATE,
    endDate: meta?.endDate || resolveSubjectEndDate({ code, name: schedule.subject?.name, endDate: schedule.subject?.endDate }),
  };
};

// All callers use inclusive operational calendar-day boundaries.
export const isScheduleWithinSubjectDates = (schedule, referenceDate, map) => {
  const ref = normalizeDate(referenceDate);
  const { startDate, endDate } = getScheduleSubjectRange(schedule, map);
  return ref >= startDate && ref <= endDate;
};

export const resolveScheduleSubjectStartDate = async (schedule) => {
  const { byId, byCode } = await buildSubjectStartDateMap();

  const subjectId = schedule.subject?._id?.toString() || schedule.subject?.toString();
  if (subjectId && byId.has(subjectId)) {
    return byId.get(subjectId).startDate;
  }

  const subjectCode = schedule.subjectCode?.trim();
  if (subjectCode && byCode.has(subjectCode)) {
    return byCode.get(subjectCode).startDate;
  }

  return null;
};

export const resolveScheduleSubjectEndDate = async (schedule) => {
  const { byId, byCode } = await buildSubjectStartDateMap();

  const subjectId = schedule.subject?._id?.toString() || schedule.subject?.toString();
  if (subjectId && byId.has(subjectId)) {
    return byId.get(subjectId).endDate || DEFAULT_SUBJECT_END_DATE;
  }

  const subjectCode = schedule.subjectCode?.trim();
  if (subjectCode && byCode.has(subjectCode)) {
    return byCode.get(subjectCode).endDate || DEFAULT_SUBJECT_END_DATE;
  }

  return DEFAULT_SUBJECT_END_DATE;
};

export const isScheduleActiveOnDate = async (schedule, referenceDate) =>
  isScheduleWithinSubjectDates(schedule, referenceDate, await buildSubjectStartDateMap());
