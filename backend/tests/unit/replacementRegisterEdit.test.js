import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllReplacements } from '../../controllers/replacementController.js';
import Leave from '../../models/Leave.js';
import Trainer from '../../models/Trainer.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';

const query = (rows) => ({
  populate() { return this; },
  select() { return this; },
  sort() { return this; },
  lean: async () => rows,
  then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
});

test('approved previous-date replacements can still be assigned, edited, or deleted', async (t) => {
  const leaves = [
    {
      _id: 'assigned-past',
      trainer: { _id: 'trainer', name: 'On Leave' },
      status: 'approved',
      startDate: new Date('2024-09-04'),
      endDate: new Date('2024-09-04'),
      replacements: [{
        schedule: 'slot-assigned',
        replacementTrainer: { _id: 'cover', name: 'Cover', employeeId: '9' },
      }],
      affectedSchedules: [{
        _id: 'slot-assigned',
        day: 'Wednesday',
        startTime: '09:00',
        endTime: '10:00',
      }],
    },
    {
      _id: 'open-past',
      trainer: { _id: 'trainer', name: 'On Leave' },
      status: 'approved',
      startDate: new Date('2024-09-04'),
      endDate: new Date('2024-09-04'),
      replacements: [],
      affectedSchedules: [{
        _id: 'slot-open',
        day: 'Wednesday',
        startTime: '10:30',
        endTime: '12:30',
      }],
    },
  ];

  t.mock.method(Leave, 'find', () => query(leaves));
  t.mock.method(Trainer, 'find', () => query([]));
  t.mock.method(ClassCancellation, 'find', () => query([]));
  t.mock.method(OfficialHoliday, 'find', () => query([]));

  let result;
  await getAllReplacements({ query: { limit: 10 } }, {
    json(data) { result = data; },
  });

  const assigned = result.replacements.find((row) => row.leave._id === 'assigned-past');
  const open = result.replacements.find((row) => row.leave._id === 'open-past');

  assert.equal(assigned.timelineStatus, 'previous');
  assert.equal(assigned.canChange, true);
  assert.equal(assigned.canAssign, false);
  assert.equal(open.timelineStatus, 'previous');
  assert.equal(open.canAssign, true);
  assert.equal(open.canChange, false);
});
