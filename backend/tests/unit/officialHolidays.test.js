import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWorkedOfficialHoliday,
  resolveOfficialHolidayAttendance,
} from '../../utils/officialHolidays.js';
import { TRAINER_ATTENDANCE_TYPES } from '../../utils/trainerAttendanceTypes.js';

test('empty holiday day resolves to official Holiday', () => {
  const resolved = resolveOfficialHolidayAttendance(null);
  assert.equal(resolved.attendanceType, TRAINER_ATTENDANCE_TYPES.HOLIDAY);
  assert.equal(resolved.isNonWorking, true);
});

test('explicit OIF present survives holiday resolution', () => {
  assert.equal(isWorkedOfficialHoliday({
    punchInAt: new Date(),
    attendanceType: TRAINER_ATTENDANCE_TYPES.OIF,
    oifNumber: 'IT',
  }), true);

  const resolved = resolveOfficialHolidayAttendance({
    punchInAt: new Date(),
    attendanceType: TRAINER_ATTENDANCE_TYPES.OIF,
    oifNumber: 'IT',
  });
  assert.equal(resolved.attendanceType, TRAINER_ATTENDANCE_TYPES.OIF);
  assert.equal(resolved.isNonWorking, false);
});

test('present stays selected before an OIF number is entered; explicit holiday OIF remains distinct', () => {
  assert.deepEqual(resolveOfficialHolidayAttendance({ attendanceType: 'oif', oifNumber: '' }), {
    attendanceType: 'oif', isNonWorking: false,
  });
  assert.deepEqual(resolveOfficialHolidayAttendance({ attendanceType: 'holiday_oif', oifNumber: 'IT' }), {
    attendanceType: 'holiday_oif', isNonWorking: false,
  });
});
