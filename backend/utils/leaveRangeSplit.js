import { normalizeDate } from './scheduleHelpers.js';

export const splitLeaveRangeForPartialCancel = (leaveStart, leaveEnd, cancelStart, cancelEnd) => {
  const start = normalizeDate(leaveStart);
  const end = normalizeDate(leaveEnd);
  const removeStart = normalizeDate(cancelStart);
  const removeEnd = normalizeDate(cancelEnd);

  if (removeEnd < removeStart) {
    throw new Error('Cancel end date must be on or after the start date');
  }

  if (removeEnd < start || removeStart > end) {
    throw new Error('Cancelled range is outside the leave window');
  }

  const fullRangeCovered = removeStart <= start && removeEnd >= end;
  if (fullRangeCovered) {
    return [];
  }

  const remaining = [];

  const beforeEnd = new Date(removeStart);
  beforeEnd.setDate(beforeEnd.getDate() - 1);
  if (beforeEnd >= start) {
    remaining.push({
      startDate: new Date(start),
      endDate: new Date(beforeEnd),
    });
  }

  const afterStart = new Date(removeEnd);
  afterStart.setDate(afterStart.getDate() + 1);
  if (afterStart <= end) {
    remaining.push({
      startDate: new Date(afterStart),
      endDate: new Date(end),
    });
  }

  return remaining.filter((range) => range.startDate <= range.endDate);
};
