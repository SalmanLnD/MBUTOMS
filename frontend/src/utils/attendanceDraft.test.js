import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceCellFingerprint, attendanceCellPayload } from './attendanceDraft.js';

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
