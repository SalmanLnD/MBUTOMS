import Subject from '../models/Subject.js';
import { normalizeDate } from './scheduleHelpers.js';

/** Fallback when a schedule slot is not linked to a subject record. */
export const DEFAULT_SUBJECT_START_DATE = new Date(Date.UTC(2026, 6, 13));

let subjectStartDateCache = null;
let subjectStartDateCacheAt = 0;
const CACHE_TTL_MS = 60_000;

export const buildSubjectStartDateMap = async () => {
  const now = Date.now();
  if (subjectStartDateCache && now - subjectStartDateCacheAt < CACHE_TTL_MS) {
    return subjectStartDateCache;
  }

  const subjects = await Subject.find().select('_id code startDate');
  const byId = new Map();
  const byCode = new Map();

  subjects.forEach((subject) => {
    const startDate = normalizeDate(subject.startDate);
    byId.set(subject._id.toString(), startDate);
    if (subject.code) {
      byCode.set(subject.code.trim(), startDate);
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
    return byId.get(subjectId);
  }

  const subjectCode = schedule.subjectCode?.trim();
  if (subjectCode && byCode.has(subjectCode)) {
    return byCode.get(subjectCode);
  }

  return null;
};

export const isScheduleActiveOnDate = async (schedule, referenceDate) => {
  const ref = normalizeDate(referenceDate);
  const startDate = await resolveScheduleSubjectStartDate(schedule);
  const effectiveStart = startDate ?? DEFAULT_SUBJECT_START_DATE;
  return ref >= effectiveStart;
};
