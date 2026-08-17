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

test('punched holiday day stays as worked holiday', () => {
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
  assert.equal(resolved.attendanceType, TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF);
  assert.equal(resolved.isNonWorking, false);
});
