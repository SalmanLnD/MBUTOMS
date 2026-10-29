import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMarkEntries } from '../../ai/aiMarkEntries.js';
import { executeAiTool, validateToolArguments } from '../../ai/aiTools.js';
const students = [{ _id: 'a' }, { _id: 'b' }];
test('missing reports, zero, absence and empty rosters have distinct completion states', () => {
  assert.equal(summarizeMarkEntries(students, []).status, 'completely_pending');
  assert.equal(summarizeMarkEntries([], []).status, 'no_students');
  assert.equal(summarizeMarkEntries(students, [{ student: 'a', marksObtained: 0 }]).status, 'partially_pending');
  assert.equal(summarizeMarkEntries(students, [{ student: 'a', marksObtained: 0 }, { student: 'b', attendance: 'A' }]).status, 'complete');
  assert.equal(summarizeMarkEntries(students, [{ student: 'other', marksObtained: 10 }, { student: 'a', marksObtained: null }]).pending, 2);
});
test('marks month and status validation rejects invalid input', () => {
  for (const month of ['2026-13', '2026-07', '2027-01']) assert.throws(() => validateToolArguments('get_mark_entry_status', { month }, new Date('2026-10-29')));
  assert.throws(() => validateToolArguments('get_mark_entry_status', { month: '2026-09', entryStatus: 'pending' }));
});
test('controller permission denials propagate without querying student data', async () => {
  const result = await executeAiTool('get_mark_entry_status', { month: '2026-09' }, { user: { role: 'trainer', trainer: 'own' } }, { read: async () => ({ error: 'forbidden' }) });
  assert.equal(result.error, 'forbidden');
});
