import { normalizeDate } from './scheduleHelpers.js';
import { toLeaveDateKey } from './leaveDateRange.js';
import { splitLeaveRangeForPartialCancel } from './leaveRangeSplit.js';

// Keep the existing range-based replacement rules throughout attendance/tracker
// reporting by isolating a day in its own leave record when it is edited.
export const scopeReplacementOccurrence = (leave, date, schedule) => {
  if (!date) return null; // Existing API callers may still edit a whole range.
  const day = normalizeDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.getTime())
    || toLeaveDateKey(day) !== date
    || date < toLeaveDateKey(leave.startDate) || date > toLeaveDateKey(leave.endDate)
    || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${date}T12:00:00Z`).getUTCDay()] !== schedule.day) {
    const error = new Error('Select a valid class date within the leave period');
    error.statusCode = 400;
    throw error;
  }
  const remaining = splitLeaveRangeForPartialCancel(leave.startDate, leave.endDate, day, day);
  const snapshot = leave.toObject({ depopulate: true });
  delete snapshot._id;
  delete snapshot.__v;
  const siblings = remaining.map((range) => ({ ...snapshot, ...range }));
  leave.startDate = day;
  leave.endDate = day;
  return siblings;
};

export const saveReplacementOccurrence = async (Leave, leave, siblings) => {
  if (!siblings?.length) return leave.save();
  // The original range and retained ranges must change atomically.
  return Leave.db.transaction(async (session) => {
    await Leave.create(siblings, { session });
    await leave.save({ session });
  });
};
