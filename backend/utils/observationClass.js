export const REPLACEMENT_CLASS_LABEL = 'Replacement class';

export const isReplacementClassObservation = (observation = {}) => {
  if (!observation) return false;
  if (observation.schedule) return false;
  return observation.department === REPLACEMENT_CLASS_LABEL;
};

export const buildReplacementClassFields = () => ({
  schedule: null,
  department: REPLACEMENT_CLASS_LABEL,
  section: '',
  slot: '',
  startTime: '',
  endTime: '',
  day: '',
  subjectCode: '',
});
