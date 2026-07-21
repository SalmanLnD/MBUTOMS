import { isCampusSubjectOif } from './subjectOifCatalog.js';

export const IT_OIF_CODE = 'IT';
export const IT_MOCK_PREP_HOURS = 7;

export const isItOif = (oifNumber) => {
  const value = String(oifNumber || '').trim().toUpperCase();
  return value.startsWith(IT_OIF_CODE);
};

export const countsAsOifDay = (oifNumber) => {
  const value = String(oifNumber || '').trim();
  return Boolean(value) && !isItOif(value);
};

/** Non-campus OIFs (e.g. external sessions) allow manual class-hour entry. */
export const allowsManualClassHandlingHours = (oifNumber) => {
  const value = String(oifNumber || '').trim();
  if (!value || isItOif(value)) return false;
  return !isCampusSubjectOif(value);
};

export const resolveMockPrepHoursForOif = (oifNumber, mockPrepHours) =>
  (isItOif(oifNumber) ? IT_MOCK_PREP_HOURS : Number(mockPrepHours ?? 0));

export const resolveClassHandlingHoursForOif = (oifNumber, classHandlingHours) =>
  (isItOif(oifNumber) ? 0 : Number(classHandlingHours ?? 0));

export const applyItOifAttendanceRules = ({ oifNumber, mockPrepHours, classHandlingHours }) => ({
  mockPrepHours: resolveMockPrepHoursForOif(oifNumber, mockPrepHours),
  classHandlingHours: resolveClassHandlingHoursForOif(oifNumber, classHandlingHours),
});
