import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceCellFingerprint, attendanceCellPayload, mergeFailedAttendanceDrafts } from './attendanceDraft.js';

test('unchanged attendance inputs compare equal after numeric input strings and API metadata', () => {
  const saved = { attendanceType: 'oif', oifNumber: '123', mockPrepHours: 2, classHandlingHours: 3, foodAllowance: '', id: 'record-1' };
  assert.equal(attendanceCellFingerprint(saved), attendanceCellFingerprint({ ...saved, mockPrepHours: '2', classHandlingHours: '3.0', isFuture: false }));
  for (const field of ['oifNumber', 'attendanceType', 'foodAllowance', 'mockPrepHours', 'classHandlingHours']) {
    assert.notEqual(attendanceCellFingerprint(saved), attendanceCellFingerprint({ ...saved, [field]: field.includes('Hours') ? 4 : 'different' }));
  }
});

test('blank leave, Sunday and holiday attendance types retain backend default semantics', () => {
  for (const context of [{ isOnLeave: true }, { isSundayWeekOff: true }, { isOfficialHoliday: true }]) {
    assert.equal(attendanceCellPayload({ ...context, attendanceType: '' }).attendanceType, '');
    assert.equal(attendanceCellPayload(context).attendanceType, '');
  }
});

test('refresh keeps failed edits, updates other server cells, and recalculates the visible totals', () => {
  const data = { dates: [{ key: '2026-11-01' }, { key: '2026-11-02' }], rows: [
    { trainer: { _id: 'a' }, days: {
      '2026-11-01': { attendanceType: 'oif', oifNumber: '123', mockPrepHours: 0, classHandlingHours: 2, isOnLeave: false },
      '2026-11-02': { mockPrepHours: 3, classHandlingHours: 4, isOnLeave: true, isReplacementRequired: true },
    } },
    { trainer: { _id: 'b' }, days: {} },
  ] };
  const drafts = new Map([['a|2026-11-01', attendanceCellPayload({ attendanceType: 'oif', oifNumber: '456', mockPrepHours: 2, classHandlingHours: 6 })]]);
  const merged = mergeFailedAttendanceDrafts(data, drafts);
  assert.equal(merged.rows[0].days['2026-11-01'].oifNumber, '456');
  assert.equal(merged.rows[0].days['2026-11-02'].classHandlingHours, 4);
  assert.equal(merged.rows[0].totals.mockPrepHours, 5);
  assert.equal(merged.rows[0].totals.classHandlingHours, 10);
  assert.equal(merged.rows[0].totals.replacementRequiredDays, 1);
  assert.equal(merged.rows[1], data.rows[1]);
  assert.equal(data.rows[0].days['2026-11-01'].oifNumber, '123', 'never mutate the canonical server cache');
  assert.equal(mergeFailedAttendanceDrafts(data, new Map()), data);
});
