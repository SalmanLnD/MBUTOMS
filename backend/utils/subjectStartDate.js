import Subject from '../models/Subject.js';
import { normalizeAttendanceDate as normalizeDate } from './attendanceTracking.js';
import { createAsyncReportCache } from './asyncReportCache.js';
import { invalidateDerivedData } from './dataRevision.js';

/** Fallback when a schedule slot is not linked to a subject record. */
export const DEFAULT_SUBJECT_START_DATE = new Date(Date.UTC(2026, 6, 13));
export const DEFAULT_SUBJECT_END_DATE = new Date(Date.UTC(2026, 10, 10));

const SOLAS_END_DATE = new Date(Date.UTC(2026, 10, 10));
const SCHOOL_END_DATE = new Date(Date.UTC(2026, 10, 6));

const normalizeString = (value) => String(value || '').trim();

export const resolveSubjectEndDate = (subject = {}) => {
  const code = normalizeString(subject.code).toUpperCase();
  const name = normalizeString(subject.name).toUpperCase();

  if (subject.endDate) {
    return normalizeDate(subject.endDate);
  }

  if (
    code === '22CA102006'
    || code === 'PSTJ'
    || /PSTJ|DSAP|QAVA/.test(name)
    || /22CA102006|22LG101702/.test(code)
  ) {
    return new Date(SOLAS_END_DATE);
  }

  if (
    code === '22LG101703'
    || code === 'LRRE'
    || code === 'PSTP'
    || code === 'IDSA'
    || /PSTP|IDSA|LRRE/.test(name)
    || /22CS102033|22LG101703/.test(code)
  ) {
    return new Date(SCHOOL_END_DATE);
  }

  return null;
};

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
  const id = schedule.subject?._id?.toString() || schedule.subject?.toString();
  const code = String(schedule.subjectCode || schedule.subject?.code || '').trim();
  const meta = map.byId.get(id) || map.byCode.get(code);
  return {
    startDate: meta?.startDate || DEFAULT_SUBJECT_START_DATE,
    endDate: meta?.endDate || DEFAULT_SUBJECT_END_DATE,
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
