import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanceledScheduleIdsByDate } from '../../utils/leaveAffectedClasses.js';

test('pending backlog holiday/cancellation date keys align with leave date keys', () => {
  const map = buildCanceledScheduleIdsByDate([
    {
      date: '2026-09-14',
      schedules: [{ _id: { toString: () => 'sched-1' } }],
    },
  ]);
  assert.equal(map.has('2026-09-14'), true);
  assert.equal(map.get('2026-09-14').has('sched-1'), true);
});
