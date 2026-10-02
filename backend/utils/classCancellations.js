import ClassCancellation from '../models/ClassCancellation.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceTracking.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';

export const getCanceledScheduleIdsForDate = async (dateInput) => {
  const date = normalizeAttendanceDate(dateInput);
  const cancellations = await ClassCancellation.find({ date })
    .select('schedules')
    .lean();

  return new Set(
    cancellations.flatMap((entry) =>
      (entry.schedules || []).map((schedule) => schedule.toString())
    )
  );
};

/** Shared exclusions for actual classes on an IST calendar date. */
export const getClassExclusionsForDate = async (dateInput) => {
  const date = normalizeAttendanceDate(dateInput);
  const [canceledScheduleIds, holidayMap] = await Promise.all([
    getCanceledScheduleIdsForDate(date),
    loadOfficialHolidayMap(date, date),
  ]);
  return { canceledScheduleIds, isOfficialHoliday: holidayMap.has(toAttendanceDateKey(date)) };
};

export const excludeCanceledSchedules = (schedules, canceledScheduleIds) =>
  schedules.filter((schedule) => !canceledScheduleIds.has(schedule._id.toString()));
