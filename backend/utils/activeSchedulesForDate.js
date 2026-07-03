import Schedule from '../models/Schedule.js';
import { isScheduleActiveOnDate } from './subjectStartDate.js';

export async function filterSchedulesActiveOnDate(schedules, referenceDate = new Date()) {
  if (!schedules.length) return [];

  const flags = await Promise.all(
    schedules.map((schedule) => isScheduleActiveOnDate(schedule, referenceDate))
  );

  return schedules.filter((_, index) => flags[index]);
}

export async function getActiveSchedulesForDay(dayName, referenceDate = new Date()) {
  const schedules = await Schedule.find({ day: dayName });
  const active = await filterSchedulesActiveOnDate(schedules, referenceDate);
  return { schedules: active, count: active.length };
}
