const OPERATIONS_TIMEZONE = 'Asia/Kolkata';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Convert strings and stored Date values to the operational IST calendar day.
 * Plain YYYY-MM-DD inputs are preserved so server timezone never shifts them.
 */
export const toLeaveDateKey = (dateInput) => {
  const raw = String(dateInput || '').trim();
  if (DATE_KEY_PATTERN.test(raw)) return raw;

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Return the UTC instants bounding an IST calendar day.
 *
 * Historical leave rows were written both as IST midnight (18:30Z on the
 * previous day) and UTC midnight. Both representations fall inside this
 * window, so queries remain compatible with existing data.
 */
export const getLeaveDayWindow = (dateInput) => {
  const key = toLeaveDateKey(dateInput);
  if (!key) throw new Error('Invalid leave date');

  const start = new Date(`${key}T00:00:00+05:30`);
  const endExclusive = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { key, start, endExclusive };
};

export const getLeaveRangeWindow = (startInput, endInput = startInput) => {
  const first = getLeaveDayWindow(startInput);
  const last = getLeaveDayWindow(endInput);
  return {
    start: first.start,
    endExclusive: last.endExclusive,
    startKey: first.key,
    endKey: last.key,
  };
};

export const getLeaveOverlapFilter = (startInput, endInput = startInput) => {
  const { start, endExclusive } = getLeaveRangeWindow(startInput, endInput);
  return {
    startDate: { $lt: endExclusive },
    endDate: { $gte: start },
  };
};

export const isDateWithinLeave = (dateInput, leave) => {
  const dateKey = toLeaveDateKey(dateInput);
  const startKey = toLeaveDateKey(leave?.startDate);
  const endKey = toLeaveDateKey(leave?.endDate);
  return Boolean(dateKey && startKey && endKey && dateKey >= startKey && dateKey <= endKey);
};

/**
 * Return each calendar day in a leave range that falls on the given weekday.
 * A Monday slot in a Sat–Mon leave therefore maps to the single Monday date,
 * not the full leave span.
 */
export const getLeaveDateKeysForWeekday = (leave, weekday) => {
  const startKey = toLeaveDateKey(leave?.startDate);
  const endKey = toLeaveDateKey(leave?.endDate);
  if (!startKey || !endKey || !weekday) return [];

  const targetDay = WEEKDAYS.indexOf(weekday);
  if (targetDay < 0) return [];

  const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
  const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12));
  const keys = [];

  while (cursor <= end) {
    if (cursor.getUTCDay() === targetDay) {
      keys.push(toLeaveDateKey(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};
