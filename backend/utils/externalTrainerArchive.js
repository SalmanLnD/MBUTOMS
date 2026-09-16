import { normalizeAttendanceDate } from './attendanceDates.js';

// Soft archive is derived from tenure, so it takes effect at midnight IST even
// without a background job. Keep records and historical exports intact. Extending
// a tenure automatically makes the trainer visible again.
export const isExternalTrainerArchived = (trainer, now = new Date()) => Boolean(
  trainer?.createdAsBulkReplacement && trainer?.replacementAttendanceTo
  && normalizeAttendanceDate(trainer.replacementAttendanceTo) < normalizeAttendanceDate(now)
);

export const excludeArchivedExternalTrainers = (filter = {}, now = new Date()) => {
  const clause = { $nor: [{ createdAsBulkReplacement: true,
    replacementAttendanceTo: { $ne: null, $lt: normalizeAttendanceDate(now) } }] };
  return Object.keys(filter).length ? { $and: [filter, clause] } : clause;
};
