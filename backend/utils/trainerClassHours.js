import { buildTrainerSchedulesForDate } from './trainerScheduleView.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const computeHours = (startTime, endTime) => {
  const diff = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return Math.max(0, diff / 60);
};

export const computeClassHandlingHours = async (trainerId, referenceDate, semester = 'III') => {
  const schedules = await buildTrainerSchedulesForDate({
    trainerId,
    referenceDate,
    semester,
  });

  const dayName = WEEKDAYS[new Date(referenceDate).getDay()];
  const hours = schedules
    .filter((schedule) => schedule.day === dayName)
    .reduce((sum, schedule) => sum + computeHours(schedule.startTime, schedule.endTime), 0);

  return Math.round(hours * 10) / 10;
};
