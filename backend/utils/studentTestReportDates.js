export const STUDENT_TEST_REPORT_TRACKING_START = '2026-08-01';

export const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

export const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const formatMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const asMonthParts = (date) => {
  const value = new Date(date);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
};
const monthIndex = ({ year, month }) => year * 12 + month - 1;

export const getTrackingStartParts = () => {
  const term = getAcademicTermContext()?.term;
  return term?.startDate ? asMonthParts(term.startDate) : parseMonthKey(STUDENT_TEST_REPORT_TRACKING_START.slice(0, 7));
};

export const getCurrentMonthParts = (referenceDate = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' })
    .formatToParts(new Date(referenceDate));
  return { year: Number(parts.find((p) => p.type === 'year').value), month: Number(parts.find((p) => p.type === 'month').value) };
};

const getLatestReportParts = (referenceDate = new Date()) => {
  const current = getCurrentMonthParts(referenceDate);
  const endDate = getAcademicTermContext()?.term?.endDate;
  const end = endDate ? asMonthParts(endDate) : current;
  return monthIndex(end) < monthIndex(current) ? end : current;
};

export const clampMonthParts = ({ year, month }) => {
  const tracking = getTrackingStartParts();
  const trackingIndex = tracking.year * 12 + tracking.month - 1;
  const latest = getLatestReportParts();
  const latestIndex = latest.year * 12 + latest.month - 1;
  let index = year * 12 + month - 1;
  if (index < trackingIndex) index = trackingIndex;
  if (index > latestIndex) index = latestIndex;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const isValidReportMonth = (monthKey, referenceDate = new Date()) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey || '')) return false;
  const tracking = getTrackingStartParts();
  const { year, month } = parseMonthKey(monthKey);
  const monthIndex = year * 12 + month - 1;
  const trackingIndex = tracking.year * 12 + tracking.month - 1;
  const latest = getLatestReportParts(referenceDate);
  const latestIndex = latest.year * 12 + latest.month - 1;
  return monthIndex >= trackingIndex && monthIndex <= latestIndex;
};

export const getReportMonthKeys = (referenceDate = new Date()) => {
  const tracking = getTrackingStartParts();
  const latest = getLatestReportParts(referenceDate);
  const keys = [];
  let { year, month } = tracking;

  while (year < latest.year || (year === latest.year && month <= latest.month)) {
    keys.push(formatMonthKey(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return keys;
};

export const getMonthLabelFromKey = (monthKey) => {
  const { year, month } = parseMonthKey(monthKey);
  return formatMonthLabel(year, month);
};
import { getAcademicTermContext } from './academicTermContext.js';
