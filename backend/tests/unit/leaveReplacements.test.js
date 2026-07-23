import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dedupeReplacementsBySchedule } from '../../utils/leaveReplacements.js';

describe('dedupeReplacementsBySchedule', () => {
  it('keeps a single entry per schedule and prefers the latest assignment', () => {
    const result = dedupeReplacementsBySchedule([
      {
        schedule: 'sched-s1',
        replacementTrainer: 'barath',
        assignedAt: new Date('2026-07-20T08:00:00Z'),
      },
      {
        schedule: 'sched-s1',
        replacementTrainer: 'barath',
        assignedAt: new Date('2026-07-21T08:00:00Z'),
      },
      {
        schedule: 'sched-s1',
        replacementTrainer: 'barath',
        assignedAt: new Date('2026-07-19T08:00:00Z'),
      },
      {
        schedule: 'sched-s2',
        replacementTrainer: 'barath',
        assignedAt: new Date('2026-07-20T09:00:00Z'),
      },
    ]);

    assert.equal(result.length, 2);
    const s1 = result.find((entry) => String(entry.schedule) === 'sched-s1');
    assert.equal(new Date(s1.assignedAt).toISOString(), '2026-07-21T08:00:00.000Z');
  });
});
