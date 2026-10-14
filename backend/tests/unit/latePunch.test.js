import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLateMisconductDate,
  isLatePunch,
  lateMarkOutcome,
  punchDistanceFromCampus,
} from '../../utils/latePunch.js';

test('punches after 8:40 India time are late and 8:40:00 is on time', () => {
  assert.equal(isLatePunch('2026-10-14T03:10:00.000Z'), false);
  assert.equal(isLatePunch('2026-10-14T03:10:01.000Z'), true);
  assert.equal(isLatePunch('2026-10-14T03:00:00.000Z'), false);
  assert.equal(isLatePunch('2026-10-14T03:30:00.000Z'), true);
});

test('late misconduct starts on 14 Oct 2026', () => {
  assert.equal(isLateMisconductDate('2026-10-13'), false);
  assert.equal(isLateMisconductDate('2026-10-14'), true);
  assert.equal(isLateMisconductDate('2026-10-15'), true);
  assert.equal(isLateMisconductDate(new Date('2026-10-13T18:30:00.000Z')), true);
});

test('the first late mark in a month is a warning and later marks are misconduct', () => {
  assert.equal(lateMarkOutcome(0), 'warning');
  assert.equal(lateMarkOutcome(1), 'misconduct');
  assert.equal(lateMarkOutcome(2), 'misconduct');
});

test('campus distance is measured from the punch coordinates', () => {
  const sameSpot = punchDistanceFromCampus(
    { latitude: 13.621069, longitude: 79.289828, accuracy: 12 },
    { PUNCH_CAMPUS_LATITUDE: '13.621069', PUNCH_CAMPUS_LONGITUDE: '79.289828', PUNCH_CAMPUS_RADIUS_METERS: '1500' }
  );
  assert.equal(sameSpot.distanceMeters, 0);
  assert.equal(sameSpot.onCampus, true);
  assert.equal(sameSpot.accuracyMeters, 12);
  assert.equal(punchDistanceFromCampus({}), null);
});
