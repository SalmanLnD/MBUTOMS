import {
  formatAttendanceMonthKey,
  parseAttendanceMonthParam,
} from './attendanceDates.js';
import {
  normalizeAttendanceDate,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from './attendanceTracking.js';

/** Cycle runs from the 21st of month N to the 20th of month N+1. */
export const PLP_CYCLE_START_DAY = 21;
export const PLP_CYCLE_END_DAY = 20;

const TRACKING_START_KEY = toAttendanceDateKey(TRAINER_ATTENDANCE_TRACKING_START);

const shiftMonthParts = (year, month, delta) => {
  const index = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
};

const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatMonthLabelShort = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** Google Sheet tab name, e.g. "June-July 2026". */
export const formatPlpCycleSheetName = (startYear, startMonth, endYear, endMonth) =>
  `${MONTH_FULL_NAMES[startMonth - 1]}-${MONTH_FULL_NAMES[endMonth - 1]} ${endYear}`;

/**
 * cycleKey is the end-month key (YYYY-MM).
 * Example: 2026-07 => 21 Jun 2026 – 20 Jul 2026.
 * July feedback / observations (monthKey 2026-07) apply to this cycle.
 */
export const getPlpCycleRange = (cycleKey) => {
  const { year, month } = parseAttendanceMonthParam(cycleKey);
  const startParts = shiftMonthParts(year, month, -1);
  const startKey = `${formatAttendanceMonthKey(startParts.year, startParts.month)}-${String(PLP_CYCLE_START_DAY).padStart(2, '0')}`;
  const endKey = `${formatAttendanceMonthKey(year, month)}-${String(PLP_CYCLE_END_DAY).padStart(2, '0')}`;

  return {
    cycleKey: formatAttendanceMonthKey(year, month),
    startKey,
    endKey,
    startDate: normalizeAttendanceDate(startKey),
    endDate: normalizeAttendanceDate(endKey),
    /** Calendar month whose feedback form ratings feed this cycle. */
    feedbackMonthKey: formatAttendanceMonthKey(year, month),
    /**
     * Observations are stored per calendar month, so both months touched by the
     * 21–20 window must be read; each row is then placed by its observation date.
     */
    observationMonthKeys: [
      formatAttendanceMonthKey(startParts.year, startParts.month),
      formatAttendanceMonthKey(year, month),
    ],
    /** Month used for observations saved without a date. */
    observationMonthKey: formatAttendanceMonthKey(year, month),
    label: `${PLP_CYCLE_START_DAY} ${formatMonthLabelShort(startParts.year, startParts.month)} – ${PLP_CYCLE_END_DAY} ${formatMonthLabelShort(year, month)}`,
    shortLabel: `${formatMonthLabelShort(startParts.year, startParts.month).split(' ')[0]}–${formatMonthLabelShort(year, month)}`,
    sheetName: formatPlpCycleSheetName(startParts.year, startParts.month, year, month),
  };
};

/**
 * Dated observations belong to the cycle containing that date; undated ones fall
 * back to the cycle keyed by their calendar month.
 */
export const observationBelongsToCycle = (observation, cycle) => {
  const dateKey = String(observation?.observationDate || '').trim();
  if (dateKey) return dateKey >= cycle.startKey && dateKey <= cycle.endKey;
  return observation?.monthKey === cycle.cycleKey;
};

export const resolvePlpCycleKey = (cycleParam) => {
  const raw = String(cycleParam || '').trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const { year, month } = parseAttendanceMonthParam(raw);
  return formatAttendanceMonthKey(year, month);
};

/** Build PLP cycle options from first cycle overlapping tracking start through current/latest. */
export const buildPlpCycleOptions = (referenceDate = new Date()) => {
  const todayKey = toAttendanceDateKey(referenceDate);
  const todayParts = parseAttendanceMonthParam(todayKey);
  // Latest cycle is the one ending this calendar month (or next if after the 20th).
  let latestEnd = { ...todayParts };
  if (Number(todayKey.slice(8, 10)) > PLP_CYCLE_END_DAY) {
    latestEnd = shiftMonthParts(todayParts.year, todayParts.month, 1);
  }

  // First cycle: earliest end-month whose range overlaps tracking start.
  const trackingParts = parseAttendanceMonthParam(TRACKING_START_KEY);
  let firstEnd = { ...trackingParts };
  // If tracking starts on/before the 20th, that month's cycle already covers it;
  // if after the 20th, first full/partial cycle ends next month.
  if (Number(TRACKING_START_KEY.slice(8, 10)) > PLP_CYCLE_END_DAY) {
    firstEnd = shiftMonthParts(trackingParts.year, trackingParts.month, 1);
  }

  const options = [];
  let cursor = { ...firstEnd };
  while (
    cursor.year < latestEnd.year
    || (cursor.year === latestEnd.year && cursor.month <= latestEnd.month)
  ) {
    const cycleKey = formatAttendanceMonthKey(cursor.year, cursor.month);
    const range = getPlpCycleRange(cycleKey);
    options.push({
      value: cycleKey,
      label: range.label,
      shortLabel: range.shortLabel,
      sheetName: range.sheetName,
      startKey: range.startKey,
      endKey: range.endKey,
      feedbackMonthKey: range.feedbackMonthKey,
    });
    cursor = shiftMonthParts(cursor.year, cursor.month, 1);
  }

  return options;
};
