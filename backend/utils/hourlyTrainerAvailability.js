const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (time) => String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0');

/** Only whole-window free intervals qualify. Return explicit windows, not occupancy guesses. */
export const buildHourlyTrainerAvailability = (data, { date, startTime, endTime }, limit = 100) => {
  const source = data.trainers || [];
  const trainers = source.slice(0, limit).map((trainer) => {
    const day = (trainer.availability || []).find((entry) => entry.date === date);
    return { name: trainer.name, employeeId: trainer.employeeId || '', onLeave: Boolean(day?.onLeave),
      isOfficialHoliday: Boolean(day?.isOfficialHoliday),
      freeSlots: day && !day.onLeave ? (day.slots || []).map(({ startTime, endTime }) => ({ startTime, endTime })) : [] };
  });
  const hourly = [];
  for (let start = minutes(startTime); start < minutes(endTime);) {
    const end = Math.min((Math.floor(start / 60) + 1) * 60, minutes(endTime));
    const available = trainers.filter((trainer) => !trainer.onLeave && trainer.freeSlots.some((slot) =>
      minutes(slot.startTime) <= start && minutes(slot.endTime) >= end));
    hourly.push({ startTime: clock(start), endTime: clock(end), availableCount: available.length,
      trainers: available.map(({ name, employeeId }) => ({ name, employeeId })) });
    start = end;
  }
  return { date, timezone: 'Asia/Kolkata', startTime, endTime, basis: 'Scheduled availability for the entire returned window; not physical presence.',
    totalPermittedTrainers: source.length, trainers, hourly, truncated: source.length > limit };
};
