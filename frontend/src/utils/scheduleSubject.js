export const SAI_PRIYA_TRAINER_CODE = 'PEDH- T07';

export const PEDH_SUBJECT_CODE = '22CS102037';
export const DSAP_SUBJECT_CODE = '25CA202009';

export const inferSaiPriyaSubjectCode = (schedule) => {
  const department = String(schedule?.department || '').trim();
  const section = String(schedule?.section || '').trim();

  if (department === 'MCA' || section.toLowerCase().startsWith('mca')) {
    return DSAP_SUBJECT_CODE;
  }
  if (['CSE', 'AIML', 'DS', 'IT', 'CS', 'AI&DS'].includes(department)) {
    return PEDH_SUBJECT_CODE;
  }
  return null;
};

export const getEffectiveSubjectCode = (schedule, trainerCode) => {
  if (trainerCode === SAI_PRIYA_TRAINER_CODE) {
    return inferSaiPriyaSubjectCode(schedule) || schedule?.subjectCode || '';
  }
  return schedule?.subjectCode || '';
};

export const scheduleMatchesSubject = (schedule, subject, trainerCode) => {
  if (!subject) return true;

  const effectiveCode = getEffectiveSubjectCode(schedule, trainerCode);
  if (effectiveCode && effectiveCode === subject.code) return true;

  const scheduleSubjectId = schedule?.subject?._id || schedule?.subject;
  if (scheduleSubjectId && subject._id) {
    return String(scheduleSubjectId) === String(subject._id);
  }

  return false;
};
