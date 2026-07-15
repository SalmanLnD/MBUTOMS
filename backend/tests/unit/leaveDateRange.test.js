import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLeaveDateKeysForWeekday,
  getLeaveDayWindow,
  getLeaveOverlapFilter,
  isDateWithinLeave,
  toLeaveDateKey,
} from '../../utils/leaveDateRange.js';
import { getWeekdaysInLeaveRange } from '../../utils/trainerScheduleView.js';

test('preserves plain calendar dates independently of server timezone', () => {
  assert.equal(toLeaveDateKey('2026-07-15'), '2026-07-15');
});

test('maps both historical IST-midnight and UTC-midnight storage to one day', () => {
  assert.equal(toLeaveDateKey(new Date('2026-07-14T18:30:00.000Z')), '2026-07-15');
  assert.equal(toLeaveDateKey(new Date('2026-07-15T00:00:00.000Z')), '2026-07-15');
});

test('builds an IST day window that includes both stored representations', () => {
  const { start, endExclusive } = getLeaveDayWindow('2026-07-15');
  assert.equal(start.toISOString(), '2026-07-14T18:30:00.000Z');
  assert.equal(endExclusive.toISOString(), '2026-07-15T18:30:00.000Z');

  const filter = getLeaveOverlapFilter('2026-07-15');
  assert.equal(filter.startDate.$lt.toISOString(), endExclusive.toISOString());
  assert.equal(filter.endDate.$gte.toISOString(), start.toISOString());
});

test('matches a replacement date for either leave storage convention', () => {
  const istStoredLeave = {
    startDate: new Date('2026-07-14T18:30:00.000Z'),
    endDate: new Date('2026-07-14T18:30:00.000Z'),
  };
  const utcStoredLeave = {
    startDate: new Date('2026-07-15T00:00:00.000Z'),
    endDate: new Date('2026-07-15T00:00:00.000Z'),
  };

  assert.equal(isDateWithinLeave('2026-07-15', istStoredLeave), true);
  assert.equal(isDateWithinLeave('2026-07-15', utcStoredLeave), true);
  assert.equal(isDateWithinLeave('2026-07-16', istStoredLeave), false);
});

test('derives the correct weekday from historical IST-midnight leave dates', () => {
  assert.deepEqual(
    getWeekdaysInLeaveRange(
      new Date('2026-07-14T18:30:00.000Z'),
      new Date('2026-07-14T18:30:00.000Z')
    ),
    ['Wednesday']
  );
});

test('maps a weekday slot to the matching calendar dates inside a leave range', () => {
  const leave = {
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-03T00:00:00.000Z'),
  };

  assert.deepEqual(getLeaveDateKeysForWeekday(leave, 'Monday'), ['2026-08-03']);
  assert.deepEqual(getLeaveDateKeysForWeekday(leave, 'Saturday'), ['2026-08-01']);
  assert.deepEqual(getLeaveDateKeysForWeekday(leave, 'Tuesday'), []);
});
