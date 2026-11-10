import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOperationalDatesByTerm } from '../../utils/academicOperationalHistory.js';

test('operational dates span original semesters independently of current view', () => {
  const odd = { _id: 'odd', startDate: '2026-07-01', endDate: '2026-12-31' };
  const even = { _id: 'even', startDate: '2027-01-01', endDate: '2027-05-31' };
  const result = groupOperationalDatesByTerm(['2026-12-31', '2027-01-01', '2026-01-01'], [odd, even]);
  assert.deepEqual(result.map(group => [group.term?._id || 'legacy', group.dates]), [
    ['odd', ['2026-12-31']], ['even', ['2027-01-01']], ['legacy', ['2026-01-01']],
  ]);
});

test('ambiguous semester date coverage fails instead of attributing hours twice', () => {
  assert.throws(() => groupOperationalDatesByTerm(['2027-01-01'], [
    { _id: 'odd', startDate: '2026-07-01', endDate: '2027-01-01' },
    { _id: 'even', startDate: '2027-01-01', endDate: '2027-05-31' },
  ]), /overlap/);
});
