import { allowsManualClassHandlingHours, countsAsOifDay } from './trainerAttendanceTypes.js';

export const attendanceCellPayload = (cell = {}) => ({
  // Blank is meaningful: the API resolves leave/week-off/holiday defaults.
  attendanceType: cell.attendanceType || '',
  oifNumber: String(cell.oifNumber || ''),
  mockPrepHours: Number(cell.mockPrepHours) || 0,
  classHandlingHours: Number(cell.classHandlingHours) || 0,
  foodAllowance: cell.foodAllowance || '',
});

export const attendanceCellFingerprint = cell => JSON.stringify(attendanceCellPayload(cell));
/** A background refresh may update server data without discarding a failed edit. */
export const mergeFailedAttendanceDrafts = (data, drafts) => {
  if (!drafts.size) return data;
  return {
    ...data,
    rows: data.rows.map(row => {
      let days = row.days;
      for (const date of data.dates) {
        const draft = drafts.get(`${row.trainer._id}|${date.key}`);
        if (!draft) continue;
        if (days === row.days) days = { ...days };
        days[date.key] = { ...days[date.key], ...draft, classHoursEditable: allowsManualClassHandlingHours(draft.oifNumber) };
      }
      if (days === row.days) return row;
      const totals = { mockPrepHours: 0, classHandlingHours: 0, oifDays: 0, leaveDays: 0, replacementRequiredDays: 0, workingDays: data.dates.length };
      for (const date of data.dates) {
        const cell = days[date.key];
        if (!cell) continue;
        totals.mockPrepHours += Number(cell.mockPrepHours || 0);
        totals.classHandlingHours += Number(cell.classHandlingHours || 0);
        totals.oifDays += countsAsOifDay(cell.oifNumber) ? 1 : 0;
        totals.leaveDays += cell.isOnLeave ? 1 : 0;
        totals.replacementRequiredDays += cell.isOnLeave && cell.isReplacementRequired ? 1 : 0;
      }
      return { ...row, days, totals };
    }),
  };
};
