import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getIstNowParts,
  parseIstClockTime,
  resolveLiveVenueInstant,
  isScheduleActiveAtMinutes,
  buildReplacementByScheduleMap,
  isTrainerOnLeaveNow,
} from '../../utils/liveTrainerVenues.js';
import { LEAVE_SCOPES } from '../../utils/leaveScope.js';

describe('isScheduleActiveAtMinutes', () => {
  it('treats start as inclusive and end as exclusive', () => {
    const schedule = { startTime: '10:30', endTime: '12:30' };
    assert.equal(isScheduleActiveAtMinutes(schedule, 10 * 60 + 30), true);
    assert.equal(isScheduleActiveAtMinutes(schedule, 11 * 60), true);
    assert.equal(isScheduleActiveAtMinutes(schedule, 12 * 60 + 30), false);
    assert.equal(isScheduleActiveAtMinutes(schedule, 10 * 60 + 29), false);
  });

  it('returns false for missing times', () => {
    assert.equal(isScheduleActiveAtMinutes({}, 600), false);
  });
});

describe('getIstNowParts', () => {
  it('returns IST weekday and clock for a known instant', () => {
    // 2026-07-21 11:15 IST = 05:45 UTC
    const parts = getIstNowParts(new Date('2026-07-21T05:45:00.000Z'));
    assert.equal(parts.dateKey, '2026-07-21');
    assert.equal(parts.dayName, 'Tuesday');
    assert.equal(parts.currentTime, '11:15');
    assert.equal(parts.minutes, 11 * 60 + 15);
  });
});

describe('parseIstClockTime', () => {
  it('accepts HH:mm and rejects invalid times', () => {
    assert.equal(parseIstClockTime('09:05').minutes, 9 * 60 + 5);
    assert.equal(parseIstClockTime('9:05').currentTime, '09:05');
    assert.equal(parseIstClockTime('24:00'), null);
    assert.equal(parseIstClockTime('abc'), null);
  });
});

describe('resolveLiveVenueInstant', () => {
  it('keeps the live clock when no time is provided', () => {
    const instant = resolveLiveVenueInstant({
      now: new Date('2026-07-21T05:45:00.000Z'),
    });
    assert.equal(instant.isLive, true);
    assert.equal(instant.currentTime, '11:15');
    assert.equal(instant.dateKey, '2026-07-21');
  });

  it('uses the same IST day at the selected clock time', () => {
    const instant = resolveLiveVenueInstant({
      now: new Date('2026-07-21T05:45:00.000Z'),
      time: '14:30',
    });
    assert.equal(instant.isLive, false);
    assert.equal(instant.dateKey, '2026-07-21');
    assert.equal(instant.dayName, 'Tuesday');
    assert.equal(instant.currentTime, '14:30');
    assert.equal(instant.minutes, 14 * 60 + 30);
  });
});

describe('buildReplacementByScheduleMap', () => {
  it('maps external replacements by schedule id', () => {
    const map = buildReplacementByScheduleMap([
      {
        replacements: [{
          schedule: 'sched1',
          isExternal: true,
          externalTrainerName: 'Guest Trainer',
        }],
      },
    ]);
    assert.deepEqual(map.get('sched1'), {
      isExternal: true,
      name: 'Guest Trainer',
      trainerId: null,
      employeeId: null,
    });
  });
});

describe('isTrainerOnLeaveNow', () => {
  it('returns true for full-day leave on the reference date', () => {
    const onLeave = isTrainerOnLeaveNow({
      leaves: [{
        trainer: 'trainer1',
        startDate: new Date('2026-07-21T00:00:00+05:30'),
        endDate: new Date('2026-07-21T00:00:00+05:30'),
        scope: LEAVE_SCOPES.FULL_DAY,
        affectedSchedules: ['sched1'],
      }],
      trainerId: 'trainer1',
      trainerSchedules: [{ _id: 'sched1', day: 'Tuesday', startTime: '09:00', endTime: '10:00' }],
      referenceDate: new Date('2026-07-21T12:00:00+05:30'),
      dayName: 'Tuesday',
      minutes: 9 * 60 + 30,
    });
    assert.equal(onLeave, true);
  });
});
