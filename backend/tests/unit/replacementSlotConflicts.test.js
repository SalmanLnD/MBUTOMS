import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  trainerHasOverlappingReplacement,
  trainerHasSlotConflict,
} from '../../utils/replacementSlotConflicts.js';

describe('trainerHasOverlappingReplacement', () => {
  it('flags trainers already covering an overlapping replacement slot', () => {
    const busy = [{
      leaveId: 'leave-laxmi',
      scheduleId: 'sched-laxmi',
      day: 'Wednesday',
      startTime: '09:00',
      endTime: '10:00',
      leaveStart: new Date('2026-07-22T00:00:00+05:30'),
      leaveEnd: new Date('2026-07-22T00:00:00+05:30'),
    }];

    assert.equal(
      trainerHasOverlappingReplacement({
        busySlots: busy,
        day: 'Wednesday',
        startTime: '09:00',
        endTime: '10:00',
        dateKeys: ['2026-07-22'],
      }),
      true
    );
  });

  it('allows trainers whose replacement is in a different time window', () => {
    const busy = [{
      leaveId: 'leave-laxmi',
      scheduleId: 'sched-laxmi',
      day: 'Wednesday',
      startTime: '09:00',
      endTime: '10:00',
      leaveStart: new Date('2026-07-22T00:00:00+05:30'),
      leaveEnd: new Date('2026-07-22T00:00:00+05:30'),
    }];

    assert.equal(
      trainerHasOverlappingReplacement({
        busySlots: busy,
        day: 'Wednesday',
        startTime: '10:30',
        endTime: '12:30',
        dateKeys: ['2026-07-22'],
      }),
      false
    );
  });
});

describe('trainerHasSlotConflict', () => {
  it('treats either owned or replacement overlap as a conflict', () => {
    assert.equal(
      trainerHasSlotConflict({
        ownedSchedules: [],
        replacementBusySlots: [{
          scheduleId: 'sched-1',
          day: 'Monday',
          startTime: '09:00',
          endTime: '10:00',
          leaveStart: new Date('2026-07-20T00:00:00+05:30'),
          leaveEnd: new Date('2026-07-20T00:00:00+05:30'),
        }],
        day: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        dateKeys: ['2026-07-20'],
      }),
      true
    );

    assert.equal(
      trainerHasSlotConflict({
        ownedSchedules: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        replacementBusySlots: [],
        day: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        dateKeys: ['2026-07-20'],
      }),
      true
    );
  });
});
