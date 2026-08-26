import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import {
  getAttendanceCalendarDates,
  getAttendanceWeekdayName,
} from './attendanceDates.js';
import {
  TRAINER_ATTENDANCE_TRACKING_START,
  toAttendanceDateKey,
} from './attendanceTracking.js';
import { getLeaveOverlapFilter, isDateWithinLeave } from './leaveDateRange.js';
import { getLeaveWeekdayScheduleIds, isFullDayLeave } from './leaveScope.js';
import { loadOfficialHolidayMap } from './officialHolidays.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';

/**
 * Map of trainerId -> Replacement Required Days count for an inclusive date range.
 * RRD = full-day approved leave on a teaching weekday that is not an official holiday.
 */
export const getReplacementRequiredDaysByTrainer = async ({
  startDate,
  endDate,
  trainers = [],
} = {}) => {
  const counts = new Map(trainers.map((trainer) => [trainer._id.toString(), 0]));
  if (!trainers.length || !startDate || !endDate) return counts;

  let rangeStart = startDate < TRAINER_ATTENDANCE_TRACKING_START
    ? TRAINER_ATTENDANCE_TRACKING_START
    : startDate;
  if (rangeStart > endDate) return counts;

  const dates = getAttendanceCalendarDates(rangeStart, endDate);
  if (!dates.length) return counts;

  const trainerIds = trainers.map((trainer) => trainer._id);
  const codesByTrainer = new Map(
    trainers.map((trainer) => [trainer._id.toString(), resolveTrainerScheduleCodes(trainer)])
  );
  const allScheduleCodes = [...new Set([...codesByTrainer.values()].flat())];

  const [approvedLeaves, schedules, holidayMap] = await Promise.all([
    Leave.find({
      trainer: { $in: trainerIds },
      status: 'approved',
      ...getLeaveOverlapFilter(rangeStart, endDate),
    })
      .select('trainer startDate endDate reason scope affectedSchedules')
      .lean(),
    allScheduleCodes.length
      ? Schedule.find({ trainerCode: { $in: allScheduleCodes } })
        .select('_id trainerCode day')
        .lean()
      : [],
    loadOfficialHolidayMap(rangeStart, endDate),
  ]);

  const schedulesByCode = new Map();
  schedules.forEach((schedule) => {
    if (!schedulesByCode.has(schedule.trainerCode)) {
      schedulesByCode.set(schedule.trainerCode, []);
    }
    schedulesByCode.get(schedule.trainerCode).push(schedule);
  });

  const schedulesByTrainer = new Map();
  const trainingWeekdaysByTrainer = new Map();
  trainers.forEach((trainer) => {
    const trainerId = trainer._id.toString();
    const trainerSchedules = (codesByTrainer.get(trainerId) || [])
      .flatMap((code) => schedulesByCode.get(code) || []);
    schedulesByTrainer.set(trainerId, trainerSchedules);
    trainingWeekdaysByTrainer.set(
      trainerId,
      new Set(trainerSchedules.map((schedule) => schedule.day))
    );
  });

  const fullDayLeaveKeys = new Set();
  approvedLeaves.forEach((leave) => {
    const trainerId = leave.trainer.toString();
    const dayScheduleIds = getLeaveWeekdayScheduleIds(
      leave,
      schedulesByTrainer.get(trainerId) || []
    );
    if (!isFullDayLeave(leave, { dayScheduleIds })) return;

    dates.forEach((date) => {
      if (isDateWithinLeave(date, leave)) {
        fullDayLeaveKeys.add(`${trainerId}|${toAttendanceDateKey(date)}`);
      }
    });
  });

  trainers.forEach((trainer) => {
    const trainerId = trainer._id.toString();
    const trainingWeekdays = trainingWeekdaysByTrainer.get(trainerId) || new Set();
    let rrd = 0;
    dates.forEach((date) => {
      const dateKey = toAttendanceDateKey(date);
      if (holidayMap.has(dateKey)) return;
      if (!fullDayLeaveKeys.has(`${trainerId}|${dateKey}`)) return;
      if (trainingWeekdays.has(getAttendanceWeekdayName(date))) {
        rrd += 1;
      }
    });
    counts.set(trainerId, rrd);
  });

  return counts;
};
