import test from 'node:test';
import assert from 'node:assert/strict';
import { isBeforeTrainerJoiningDate } from '../../utils/trainerEmployment.js';

test('isBeforeTrainerJoiningDate is true for days before joining date', () => {
  const trainer = { joiningDate: new Date('2026-08-11T00:00:00.000Z') };
  assert.equal(isBeforeTrainerJoiningDate(trainer, new Date('2026-08-10T12:00:00.000Z')), true);
  assert.equal(isBeforeTrainerJoiningDate(trainer, new Date('2026-08-11T00:00:00.000Z')), false);
  assert.equal(isBeforeTrainerJoiningDate(trainer, new Date('2026-08-12T00:00:00.000Z')), false);
});

test('isBeforeTrainerJoiningDate returns false when joining date is missing', () => {
  assert.equal(isBeforeTrainerJoiningDate({}, new Date('2026-08-01T00:00:00.000Z')), false);
});
