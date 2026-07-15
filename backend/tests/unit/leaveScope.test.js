import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLeaveWeekdayScheduleIds,
  isFullDayLeave,
  LEAVE_SCOPES,
  resolveLeaveScope,
} from '../../utils/leaveScope.js';

test('explicit full-day scope is full-day', () => {
  assert.equal(isFullDayLeave({ scope: LEAVE_SCOPES.FULL_DAY }), true);
});

test('slot replacement requests are not full-day leave', () => {
  assert.equal(isFullDayLeave({ scope: LEAVE_SCOPES.SLOT }), false);
  assert.equal(
    resolveLeaveScope({ reason: 'Ad-hoc slot replacement' }),
    LEAVE_SCOPES.SLOT
  );
});

test('legacy one-slot leave is not full-day when other day slots remain', () => {
  const leave = {
    reason: 'sick',
    startDate: new Date('2026-07-14T18:30:00.000Z'),
    endDate: new Date('2026-07-14T18:30:00.000Z'),
    affectedSchedules: ['slot-1'],
  };
  const dayScheduleIds = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];

  assert.equal(isFullDayLeave(leave, { dayScheduleIds }), false);
  assert.equal(resolveLeaveScope(leave), LEAVE_SCOPES.SLOT);
});

test('legacy leave covering every day slot is full-day', () => {
  const leave = {
    reason: 'sick',
    affectedSchedules: ['slot-1', 'slot-2'],
  };
  assert.equal(isFullDayLeave(leave, { dayScheduleIds: ['slot-1', 'slot-2'] }), true);
});

test('getLeaveWeekdayScheduleIds keeps only schedules on leave weekdays', () => {
  const leave = {
    startDate: new Date('2026-07-14T18:30:00.000Z'),
    endDate: new Date('2026-07-14T18:30:00.000Z'),
  };
  const ids = getLeaveWeekdayScheduleIds(leave, [
    { _id: 'wed-1', day: 'Wednesday' },
    { _id: 'thu-1', day: 'Thursday' },
  ]);
  assert.deepEqual(ids, ['wed-1']);
});
