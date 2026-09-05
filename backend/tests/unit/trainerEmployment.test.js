import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBeforeTrainerJoiningDate,
  shouldAutoMarkTrainerRelocated,
  shouldAutoMarkTrainerExit,
  isTrainerVisibleInUi,
} from '../../utils/trainerEmployment.js';

test('isBeforeTrainerJoiningDate is true for days before joining date', () => {
  const trainer = { joiningDate: new Date('2026-08-11T00:00:00.000Z') };
  assert.equal(isBeforeTrainerJoiningDate(trainer, new Date('2026-08-10T12:00:00.000Z')), true);
  assert.equal(isBeforeTrainerJoiningDate(trainer, new Date('2026-08-11T00:00:00.000Z')), false);
  assert.equal(isBeforeTrainerJoiningDate(trainer, new Date('2026-08-12T00:00:00.000Z')), false);
});

test('isBeforeTrainerJoiningDate returns false when joining date is missing', () => {
  assert.equal(isBeforeTrainerJoiningDate({}, new Date('2026-08-01T00:00:00.000Z')), false);
});

test('relocated trainer is marked relocated from the last working date onward and never treated as exit', () => {
  const trainer = {
    employmentStatus: 'relocated',
    resignationDate: new Date('2026-08-20T00:00:00.000Z'),
    includeInAttendanceUntilMonth: '2026-08',
  };

  assert.equal(shouldAutoMarkTrainerRelocated(trainer, new Date('2026-08-19T12:00:00.000Z')), false);
  assert.equal(shouldAutoMarkTrainerRelocated(trainer, new Date('2026-08-20T12:00:00.000Z')), true);
  assert.equal(shouldAutoMarkTrainerRelocated(trainer, new Date('2026-08-21T12:00:00.000Z')), true);
  assert.equal(shouldAutoMarkTrainerExit(trainer, new Date('2026-08-21T12:00:00.000Z')), false);
  assert.equal(isTrainerVisibleInUi(trainer, new Date('2026-09-01T00:00:00.000Z')), false);
});
