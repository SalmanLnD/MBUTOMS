import { normalizeDate } from './scheduleHelpers.js';

export const toDateKey = (date) => {
  const d = normalizeDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseMonthParam = (monthParam, referenceDate = new Date()) => {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split('-').map(Number);
    return { year, month };
  }
  const ref = normalizeDate(referenceDate);
  return { year: ref.getFullYear(), month: ref.getMonth() + 1 };
};

export const getMonthRange = (year, month) => {
  const startDate = normalizeDate(new Date(year, month - 1, 1));
  const endDate = normalizeDate(new Date(year, month, 0));
  return { startDate, endDate };
};

export const clampMonthToTrackingStart = ({ year, month }, trackingStart) => {
  const { startDate } = getMonthRange(year, month);
  const tracking = normalizeDate(trackingStart);
  if (startDate < tracking) {
    return { year: tracking.getFullYear(), month: tracking.getMonth() + 1 };
  }
  return { year, month };
};

export const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const getWeekdayDates = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

export const getCalendarDates = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

export const isWeekendDate = (date) => {
  const day = normalizeDate(date).getDay();
  return day === 0 || day === 6;
};

export const getWeekRange = (referenceDate = new Date()) => {
  const ref = normalizeDate(referenceDate);
  const day = ref.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + mondayOffset);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return { startDate: monday, endDate: friday };
};

export const groupDatesByWeek = (dates) => {
  if (!dates.length) return [];

  const groups = [];
  let current = null;

  dates.forEach((date) => {
    const d = normalizeDate(date);
    const monday = new Date(d);
    const day = d.getDay();
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const weekKey = toDateKey(monday);

    if (!current || current.key !== weekKey) {
      current = { key: weekKey, dates: [] };
      groups.push(current);
    }
    current.dates.push(d);
  });

  return groups.map((group) => {
    const first = group.dates[0];
    const last = group.dates[group.dates.length - 1];
    const fmt = (dt) => dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return {
      key: group.key,
      label: group.dates.length === 1 ? fmt(first) : `${fmt(first)} – ${fmt(last)}`,
      dateKeys: group.dates.map(toDateKey),
    };
  });
};
