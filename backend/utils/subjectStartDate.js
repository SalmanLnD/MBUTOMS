import Subject from '../models/Subject.js';
import { normalizeDate } from './scheduleHelpers.js';

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

let subjectStartDateCache = null;
let subjectStartDateCacheAt = 0;
const CACHE_TTL_MS = 60_000;

export const buildSubjectStartDateMap = async () => {
  const now = Date.now();
  if (subjectStartDateCache && now - subjectStartDateCacheAt < CACHE_TTL_MS) {
    return subjectStartDateCache;
  }

  const subjects = await Subject.find().select('_id code name startDate endDate');
  const byId = new Map();
  const byCode = new Map();

  subjects.forEach((subject) => {
    const startDate = subject.startDate ? normalizeDate(subject.startDate) : DEFAULT_SUBJECT_START_DATE;
    const endDate = subject.endDate ? normalizeDate(subject.endDate) : resolveSubjectEndDate(subject);

    byId.set(subject._id.toString(), { startDate, endDate: endDate || null });
    if (subject.code) {
      byCode.set(subject.code.trim(), { startDate, endDate: endDate || null });
    }
  });

  subjectStartDateCache = { byId, byCode };
  subjectStartDateCacheAt = now;
  return subjectStartDateCache;
};

export const clearSubjectStartDateCache = () => {
  subjectStartDateCache = null;
  subjectStartDateCacheAt = 0;
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

export const isScheduleActiveOnDate = async (schedule, referenceDate) => {
  const ref = normalizeDate(referenceDate);
  const startDate = await resolveScheduleSubjectStartDate(schedule);
  const effectiveStart = startDate ?? DEFAULT_SUBJECT_START_DATE;
  return ref >= effectiveStart;
};
