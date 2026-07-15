import Schedule from '../models/Schedule.js';
import {
  buildSubjectStartDateMap,
  DEFAULT_SUBJECT_START_DATE,
} from './subjectStartDate.js';
import { normalizeDate } from './scheduleHelpers.js';

export async function filterSchedulesActiveOnDate(schedules, referenceDate = new Date()) {
  if (!schedules.length) return [];
  const { byId, byCode } = await buildSubjectStartDateMap();
  const ref = normalizeDate(referenceDate);

  return schedules.filter((schedule) => {
    const subjectId = schedule.subject?._id?.toString() || schedule.subject?.toString();
    const subjectCode = schedule.subjectCode?.trim();
    const startDate = (subjectId && byId.get(subjectId))
      || (subjectCode && byCode.get(subjectCode))
      || DEFAULT_SUBJECT_START_DATE;
    return ref >= startDate;
  });
}

export async function getActiveSchedulesForDay(dayName, referenceDate = new Date()) {
  const schedules = await Schedule.find({ day: dayName });
  const active = await filterSchedulesActiveOnDate(schedules, referenceDate);
  return { schedules: active, count: active.length };
}
