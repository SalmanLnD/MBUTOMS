import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceTypeUsesOifNumber,
  canEditFutureLeaveAttendance,
  formatTrainerAttendanceOifDisplay,
  isLeaveAttendanceType,
  LEAVE_ATTENDANCE_TYPES,
  TRAINER_ATTENDANCE_TYPES,
} from '../../utils/trainerAttendanceTypes.js';

test('defines all requested leave attendance types', () => {
  assert.deepEqual(LEAVE_ATTENDANCE_TYPES, [
    'leave',
    'leave_oif',
    'lwo',
    'comp_off',
    'exit',
    'break',
    'week_off',
    'week_off_oif',
    'e_leave',
    'holiday_oif',
    'holiday',
  ]);
  LEAVE_ATTENDANCE_TYPES.forEach((type) => assert.equal(isLeaveAttendanceType(type), true));
});

test('only OIF-backed types retain editable OIF numbers', () => {
  assert.equal(attendanceTypeUsesOifNumber(TRAINER_ATTENDANCE_TYPES.OIF), true);
  assert.equal(attendanceTypeUsesOifNumber(TRAINER_ATTENDANCE_TYPES.LEAVE_OIF), true);
  assert.equal(attendanceTypeUsesOifNumber(TRAINER_ATTENDANCE_TYPES.WEEK_OFF_OIF), true);
  assert.equal(attendanceTypeUsesOifNumber(TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF), true);
  assert.equal(attendanceTypeUsesOifNumber(TRAINER_ATTENDANCE_TYPES.HOLIDAY), false);
  assert.equal(attendanceTypeUsesOifNumber(TRAINER_ATTENDANCE_TYPES.LEAVE), false);
  assert.equal(attendanceTypeUsesOifNumber(TRAINER_ATTENDANCE_TYPES.LWO), false);
});

test('formats leave OIF sheet values with the full entered number', () => {
  assert.equal(
    formatTrainerAttendanceOifDisplay(TRAINER_ATTENDANCE_TYPES.WEEK_OFF_OIF, 'ca26421'),
    'W.Off - ca26421'
  );
  assert.equal(
    formatTrainerAttendanceOifDisplay(TRAINER_ATTENDANCE_TYPES.LEAVE_OIF, 'ca26421'),
    'Leave - ca26421'
  );
  assert.equal(
    formatTrainerAttendanceOifDisplay(TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF, 'ca26421'),
    'ca26421 - Holiday'
  );
  assert.equal(
    formatTrainerAttendanceOifDisplay(TRAINER_ATTENDANCE_TYPES.LWO, ''),
    'L.W.O'
  );
  assert.equal(
    formatTrainerAttendanceOifDisplay(TRAINER_ATTENDANCE_TYPES.WEEK_OFF, ''),
    'W.O'
  );
  assert.equal(
    formatTrainerAttendanceOifDisplay(TRAINER_ATTENDANCE_TYPES.OIF, 'IT'),
    'IT'
  );
});

test('only admins can set leave types on future full-day leave', () => {
  assert.equal(canEditFutureLeaveAttendance({
    role: 'admin',
    isOnFullDayLeave: true,
  }), true);
  assert.equal(canEditFutureLeaveAttendance({
    role: 'campus_manager',
    isOnFullDayLeave: true,
  }), false);
  assert.equal(canEditFutureLeaveAttendance({
    role: 'admin',
    isOnFullDayLeave: false,
  }), false);
});
