import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllReplacements } from '../../controllers/replacementController.js';
import Leave from '../../models/Leave.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';

test('date sorting uses occurrence/bulk dates across all pages, in both directions', async (t) => {
  const query = (rows) => ({
    populate() { return this; }, select() { return this; }, sort() { return this; },
    lean: async () => rows, then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  });
  const leave = (id, day, start, end, extra = {}) => ({
    _id: id, trainer: { _id: 'trainer', name: 'Trainer' }, status: 'approved',
    startDate: new Date(start), endDate: new Date(end), replacements: [],
    affectedSchedules: [{ _id: `slot-${id}`, day, startTime: '09:00', endTime: '10:00' }],
    ...extra,
  });
  // Query order and leave-start order differ from the dates displayed in the register.
  const leaves = [
    leave('later', 'Friday', '2026-09-14', '2026-09-18'),
    leave('earlier', 'Tuesday', '2026-09-15', '2026-09-15'),
    leave('bulk', 'Wednesday', '2026-09-14', '2026-09-20', {
      bulkReplacement: { groupId: 'group', fromDate: '2026-09-16', toDate: '2026-09-17' },
    }),
  ];
  t.mock.method(Leave, 'find', () => query(leaves));
  t.mock.method(ClassCancellation, 'find', () => query([]));
  t.mock.method(OfficialHoliday, 'find', () => query([]));
  for (const [sortOrder, expected] of [['asc', ['earlier', 'bulk', 'later']], ['desc', ['later', 'bulk', 'earlier']]]) {
    for (let page = 1; page <= 3; page += 1) {
      let result;
      await getAllReplacements({ query: { sortBy: 'date', sortOrder, page, limit: 1 } }, {
        json(data) { result = data; },
      });
      assert.equal(result.replacements[0].leave._id, expected[page - 1]);
      assert.equal(result.pagination.total, 3);
    }
  }
});
