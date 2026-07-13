import { buildTrainerSchedulesForDate } from './trainerScheduleView.js';
import { isScheduleActiveOnDate } from './subjectStartDate.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const computeHours = (startTime, endTime) => {
  const diff = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return Math.max(0, diff / 60);
};

export const computeClassHandlingHours = async (trainerId, referenceDate, semester = null) => {
  const schedules = await buildTrainerSchedulesForDate({
    trainerId,
    referenceDate,
    semester,
  });

  const dayName = WEEKDAYS[new Date(referenceDate).getDay()];
  const activeSchedules = [];

  for (const schedule of schedules) {
    if (schedule.day !== dayName) continue;
    const active = await isScheduleActiveOnDate(schedule, referenceDate);
    if (active) activeSchedules.push(schedule);
  }

  const hours = activeSchedules.reduce(
    (sum, schedule) => sum + computeHours(schedule.startTime, schedule.endTime),
    0
  );

  return Math.round(hours * 10) / 10;
};
