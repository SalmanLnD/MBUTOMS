import ClassCancellation from '../models/ClassCancellation.js';
import { normalizeAttendanceDate } from './attendanceTracking.js';

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

export const excludeCanceledSchedules = (schedules, canceledScheduleIds) =>
  schedules.filter((schedule) => !canceledScheduleIds.has(schedule._id.toString()));
