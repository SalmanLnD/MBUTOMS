import { isCampusSubjectOif } from './subjectOifCatalog.js';
import { ADMIN_TRAINER_EMPLOYEE_ID } from './trainerMappings.js';

export const IT_OIF_CODE = 'IT';
export const CA26421_OIF_CODE = 'CA26421';
export const IT_MOCK_PREP_HOURS = 7;

/** Trainers who default to an OIF on working days with no timetable classes. */
export const DEFAULT_NO_CLASS_OIF_BY_EMPLOYEE_ID = {
  [ADMIN_TRAINER_EMPLOYEE_ID]: CA26421_OIF_CODE,
};

export const isItOif = (oifNumber) => {
  const value = String(oifNumber || '').trim().toUpperCase();
  return value.startsWith(IT_OIF_CODE) || value === CA26421_OIF_CODE || value.startsWith(`${CA26421_OIF_CODE} `);
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

/**
 * Default OIF for configured trainers on days with no class hours.
 * Does not override a saved/entered OIF; callers keep the field editable.
 */
export const resolveDefaultNoClassOif = ({
  employeeId,
  oifNumber,
  classHandlingHours = 0,
} = {}) => {
  const existing = String(oifNumber || '').trim();
  if (existing) return existing;
  if (Number(classHandlingHours) > 0) return '';
  const fallback = DEFAULT_NO_CLASS_OIF_BY_EMPLOYEE_ID[String(employeeId || '').trim()];
  return fallback || '';
};
