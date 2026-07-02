export const toInputDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getWeekRange = (referenceDate = new Date()) => {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  const day = ref.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { startDate: monday, endDate: friday };
};

export const shiftWeek = (referenceDate, weeks) => {
  const next = new Date(referenceDate);
  next.setDate(next.getDate() + weeks * 7);
  return next;
};

export const formatWeekLabel = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startLabel = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const endLabel = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
};
