export const IT_OIF_CODE = 'IT';
export const IT_MOCK_PREP_HOURS = 7;

export const isItOif = (oifNumber) =>
  String(oifNumber || '').trim().toUpperCase() === IT_OIF_CODE;

export const resolveMockPrepHoursForOif = (oifNumber, mockPrepHours) =>
  (isItOif(oifNumber) ? IT_MOCK_PREP_HOURS : Number(mockPrepHours ?? 0));

export const resolveClassHandlingHoursForOif = (oifNumber, classHandlingHours) =>
  (isItOif(oifNumber) ? 0 : Number(classHandlingHours ?? 0));

export const applyItOifAttendanceRules = ({ oifNumber, mockPrepHours, classHandlingHours }) => ({
  mockPrepHours: resolveMockPrepHoursForOif(oifNumber, mockPrepHours),
  classHandlingHours: resolveClassHandlingHoursForOif(oifNumber, classHandlingHours),
});
