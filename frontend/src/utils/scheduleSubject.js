export const getEffectiveSubjectCode = (schedule) => schedule?.subjectCode || '';

export const scheduleMatchesSubject = (schedule, subject) => {
  if (!subject) return true;

  const effectiveCode = getEffectiveSubjectCode(schedule);
  if (effectiveCode && effectiveCode === subject.code) return true;

  const scheduleSubjectId = schedule?.subject?._id || schedule?.subject;
  if (scheduleSubjectId && subject._id) {
    return String(scheduleSubjectId) === String(subject._id);
  }

  return false;
};

/** Prefer an explicit legacy schedule code when the trainer has one. */
export const resolveScheduleTrainerCode = (trainer, existingSchedule) => {
  if (existingSchedule?.trainerCode) return existingSchedule.trainerCode;
  const legacyCode = (trainer?.scheduleTrainerCodes || []).find(Boolean);
  if (legacyCode) return legacyCode;
  return trainer?.employeeId || '';
};
