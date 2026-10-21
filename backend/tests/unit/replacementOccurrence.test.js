import test from 'node:test';
import assert from 'node:assert/strict';
import Leave from '../../models/Leave.js';
import { scopeReplacementOccurrence, saveReplacementOccurrence } from '../../utils/replacementOccurrence.js';
import { toLeaveDateKey } from '../../utils/leaveDateRange.js';
import { getReplacementSuggestions } from '../../controllers/replacementController.js';
import Schedule from '../../models/Schedule.js';
import Trainer from '../../models/Trainer.js';
import Subject from '../../models/Subject.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';

const makeLeave = () => new Leave({
  trainer: '507f1f77bcf86cd799439011', reason: 'Leave', status: 'approved',
  startDate: new Date('2026-10-21'), endDate: new Date('2026-11-04'),
  affectedSchedules: ['507f1f77bcf86cd799439012'],
  replacements: [{ schedule: '507f1f77bcf86cd799439012', isExternal: true, externalTrainerName: 'Existing trainer' }],
});

test('editing one occurrence preserves leave and replacement coverage on all other dates', async () => {
  const leave = makeLeave();
  const siblings = scopeReplacementOccurrence(leave, '2026-10-28', { day: 'Wednesday' });
  assert.equal(toLeaveDateKey(leave.startDate), '2026-10-28');
  assert.equal(toLeaveDateKey(leave.endDate), '2026-10-28');
  assert.deepEqual(siblings.map((row) => [toLeaveDateKey(row.startDate), toLeaveDateKey(row.endDate)]), [
    ['2026-10-21', '2026-10-27'], ['2026-10-29', '2026-11-04'],
  ]);
  leave.replacements[0].externalTrainerName = 'New trainer';
  assert.ok(siblings.every((row) => row.replacements[0].externalTrainerName === 'Existing trainer'));
  assert.ok(siblings.every((row) => !row._id && row.status === 'approved' && row.affectedSchedules.length === 1));
  const session = {};
  const calls = [];
  const model = {
    db: { transaction: async (callback) => callback(session) },
    create: async (rows, options) => { calls.push('retain'); assert.equal(options.session, session); assert.equal(rows.length, 2); },
  };
  leave.save = async (options) => { calls.push('save'); assert.equal(options.session, session); };
  await saveReplacementOccurrence(model, leave, siblings);
  assert.deepEqual(calls, ['retain', 'save']);
});

test('invalid and unrelated dates are rejected before changing the leave', () => {
  for (const date of ['2026-10-20', '2026-11-11', '2026-10-22', 'invalid', '2026-02-30']) {
    const leave = makeLeave();
    assert.throws(() => scopeReplacementOccurrence(leave, date, { day: 'Wednesday' }), /valid class date/);
    assert.equal(toLeaveDateKey(leave.startDate), '2026-10-21');
  }
});

test('suggestions check availability only on the selected occurrence', async (t) => {
  const leave = makeLeave();
  const query = (rows) => ({
    select() { return this; }, lean: async () => rows,
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  });
  t.mock.method(Schedule, 'findById', async () => ({
    _id: leave.affectedSchedules[0], day: 'Wednesday', startTime: '13:45', endTime: '15:45',
  }));
  t.mock.method(Leave, 'findOne', async () => leave);
  let checkedRange;
  t.mock.method(Leave, 'find', (filter) => { checkedRange = filter; return query([]); });
  for (const model of [Schedule, Trainer, Subject, ClassCancellation, OfficialHoliday]) {
    t.mock.method(model, 'find', () => query([]));
  }
  let result;
  await getReplacementSuggestions({ params: { scheduleId: String(leave.affectedSchedules[0]) },
    query: { leaveId: String(leave._id), date: '2026-10-28' } }, {
    json(data) { result = data; },
  });
  assert.deepEqual(result.affectedDates, ['2026-10-28']);
  assert.equal(toLeaveDateKey(checkedRange.startDate.$lte), '2026-10-28');
  assert.equal(toLeaveDateKey(checkedRange.endDate.$gte), '2026-10-28');
});
