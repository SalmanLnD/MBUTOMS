export const attendanceCellPayload = (cell = {}) => ({
  // Blank is meaningful: the API resolves leave/week-off/holiday defaults.
  attendanceType: cell.attendanceType || '',
  oifNumber: String(cell.oifNumber || ''),
  mockPrepHours: Number(cell.mockPrepHours) || 0,
  classHandlingHours: Number(cell.classHandlingHours) || 0,
  foodAllowance: cell.foodAllowance || '',
});

export const attendanceCellFingerprint = cell => JSON.stringify(attendanceCellPayload(cell));
