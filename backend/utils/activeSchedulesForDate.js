import Schedule from '../models/Schedule.js';
import {
  buildSubjectStartDateMap,
  DEFAULT_SUBJECT_START_DATE,
} from './subjectStartDate.js';
import { normalizeDate } from './scheduleHelpers.js';
import { getCanceledScheduleIdsForDate } from './classCancellations.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';
import { toAttendanceDateKey } from './attendanceDates.js';

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
  const day = normalizeDate(referenceDate);
  const [schedules, canceledScheduleIds, holidayMap] = await Promise.all([
    Schedule.find({ day: dayName })
      .select('day startTime endTime department section subjectCode trainerCode subject semester')
      .sort({ startTime: 1 })
      .lean(),
    getCanceledScheduleIdsForDate(day),
    loadOfficialHolidayMap(day, day),
  ]);

  if (holidayMap.has(toAttendanceDateKey(day))) {
    return { schedules: [], count: 0, isOfficialHoliday: true };
  }

  const started = await filterSchedulesActiveOnDate(schedules, day);
  const active = started.filter(
    (schedule) => !canceledScheduleIds.has(schedule._id.toString())
  );
  return { schedules: active, count: active.length, isOfficialHoliday: false };
}
