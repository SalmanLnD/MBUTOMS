import { normalizeAttendanceDate } from './attendanceDates.js';

export const defaultSubjectEndDate = (subject = {}) => {
  const identity = `${subject.code || ''} ${subject.name || ''}`.toUpperCase();
  const extended = /\b(DSAP|QAVA|PSTJ|25CA202009|22CA102006|22LG101702)\b/.test(identity);
  return new Date(Date.UTC(2026, 10, extended ? 10 : 6));
};

export const resolveSubjectEndDate = (subject = {}) => subject.endDate
  ? normalizeAttendanceDate(subject.endDate)
  : defaultSubjectEndDate(subject);
