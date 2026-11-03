import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUncancelledScheduleDateKeys,
  hasUncancelledClassOnDate,
} from '../../utils/leaveAffectedClasses.js';
import { applyOwnershipFloor, applyOwnershipFloorsToTrainerSchedules, applyOwnershipFloorsToLeaves, inheritedOwnershipFloorKey, inheritedOwnershipFloorsByTrainer } from '../../utils/trainerTimetableOwnership.js';

const mondaySlot = {
  _id: { toString: () => 'pharmacy-monday' },
  day: 'Monday',
};

test('a class handed over on 21 Oct is not affected by a break that ends on 20 Oct', () => {
  const schedule = { ...mondaySlot, ownershipStartDate: '2026-10-21' };
  assert.deepEqual(
    getUncancelledScheduleDateKeys(
      { startDate: '2026-10-03', endDate: '2026-10-20' },
      schedule
    ),
    []
  );
  assert.equal(hasUncancelledClassOnDate([schedule], '2026-10-05', 'Monday'), false);
});

test('the same class counts from the handover date onward', () => {
  const schedule = { ...mondaySlot, ownershipStartDate: '2026-10-21' };
  assert.deepEqual(
    getUncancelledScheduleDateKeys(
      { startDate: '2026-10-03', endDate: '2026-10-31' },
      schedule
    ),
    ['2026-10-26']
  );
  assert.equal(hasUncancelledClassOnDate([schedule], '2026-10-26', 'Monday'), true);
});

test('an explicit ownership date is kept when a later floor is applied', () => {
  const schedule = { ...mondaySlot, ownershipStartDate: '2026-10-21' };
  applyOwnershipFloor([schedule], '2026-11-01');
  assert.equal(schedule.ownershipStartDate, '2026-10-21');
});

test('slots without an ownership date still count for the whole break', () => {
  assert.deepEqual(
    getUncancelledScheduleDateKeys(
      { startDate: '2026-10-03', endDate: '2026-10-20' },
      mondaySlot
    ),
    ['2026-10-05', '2026-10-12', '2026-10-19']
  );
});

test('an inbound handover never assigns a date to a successor’s unrelated existing class', async () => {
  const existing = { ...mondaySlot };
  const transferred = { ...mondaySlot, ownershipStartDate: '2026-10-21' };
  const floors = await inheritedOwnershipFloorsByTrainer(['successor']);
  applyOwnershipFloor([existing, transferred], floors.get('successor'));
  assert.equal(existing.ownershipStartDate, undefined);
  assert.equal(hasUncancelledClassOnDate([existing], '2026-10-05', 'Monday'), true);
  assert.equal(hasUncancelledClassOnDate([transferred], '2026-10-05', 'Monday'), false);
});

test('fallback helpers leave existing timetable and leave slots untouched', async () => {
  const slot = { ...mondaySlot };
  const schedules = new Map([['successor', [slot]]]);
  applyOwnershipFloorsToTrainerSchedules(schedules, new Map([['successor', '2026-10-21']]));
  const leave = { trainer: 'successor', affectedSchedules: [slot] };
  await applyOwnershipFloorsToLeaves([leave]);
  assert.equal(await inheritedOwnershipFloorKey('successor'), '');
  assert.equal(slot.ownershipStartDate, undefined);
});
