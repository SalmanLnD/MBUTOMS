const combineDateAndTime = (dateKey, timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(`${dateKey}T00:00:00`);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

export const availabilityToEvents = (availability = []) =>
  availability.flatMap((day) => {
    if (day.onLeave || !day.slots?.length) return [];

    return day.slots.map((slot, index) => ({
      id: `${day.date}-${index}`,
      title: 'Available',
      start: combineDateAndTime(day.date, slot.startTime),
      end: combineDateAndTime(day.date, slot.endTime),
      backgroundColor: '#d1e7dd',
      borderColor: '#198754',
      textColor: '#0f5132',
      classNames: ['availability-event'],
      extendedProps: {
        date: day.date,
        day: day.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    }));
  });

export const formatWeekRangeLabel = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameMonth = startDate.getMonth() === endDate.getMonth()
    && startDate.getFullYear() === endDate.getFullYear();

  const startLabel = startDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: sameMonth ? undefined : 'numeric',
  });
  const endLabel = endDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${startLabel} – ${endLabel}`;
};

export const toInputDate = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
