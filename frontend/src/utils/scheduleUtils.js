const COLORS = ['#198754', '#157347', '#146c43', '#0f5132', '#20c997', '#0d6efd'];

const DAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export const getDateForDayInRange = (dayName, rangeStart, rangeEnd) => {
  const target = DAY_INDEX[dayName];
  if (target === undefined) return null;

  const d = new Date(rangeStart);
  d.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);

  while (d <= end) {
    if (d.getDay() === target) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
};

const combineDateAndTime = (date, timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

export const formatScheduleClassLabel = (schedule) => {
  const base = `${schedule?.department || ''} ${schedule?.section || ''}`.trim();
  const trainerName = schedule?.replacementFor?.trainerName?.trim();
  if (!trainerName) return base;
  return `${base} (${trainerName}'s class)`;
};

export const scheduleToEvent = (schedule, rangeStart, rangeEnd, colorIndex = 0) => {
  const date = getDateForDayInRange(schedule.day, rangeStart, rangeEnd);
  if (!date) return null;

  const start = combineDateAndTime(date, schedule.startTime);
  const end = combineDateAndTime(date, schedule.endTime);

  return {
    id: schedule._id,
    title: formatScheduleClassLabel(schedule),
    start,
    end,
    backgroundColor: COLORS[colorIndex % COLORS.length],
    borderColor: COLORS[colorIndex % COLORS.length],
    extendedProps: {
      schedule,
      trainerCode: schedule.trainerCode,
      department: schedule.department,
      section: schedule.section,
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      semester: schedule.semester,
    },
  };
};

export const schedulesToEvents = (schedules, rangeStart, rangeEnd) =>
  schedules
    .map((s, i) => scheduleToEvent(s, rangeStart, rangeEnd, i))
    .filter(Boolean);

export const formatTimeRange = (startTime, endTime) => `${startTime} – ${endTime}`;
