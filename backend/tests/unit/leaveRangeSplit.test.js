import test from 'node:test';
import assert from 'node:assert/strict';

import { splitLeaveRangeForPartialCancel } from '../../utils/leaveRangeSplit.js';
import { toLeaveDateKey } from '../../utils/leaveDateRange.js';

test('last IST day can be cancelled from a range stored at IST midnight', () => {
  const result = splitLeaveRangeForPartialCancel(
    new Date('2026-10-21T18:30:00Z'), new Date('2026-10-23T18:30:00Z'),
    '2026-10-24', '2026-10-24');
  assert.deepEqual(result.map((row) => [toLeaveDateKey(row.startDate), toLeaveDateKey(row.endDate)]),
    [['2026-10-22', '2026-10-23']]);
});

test('partial cancel splits a leave range into remaining before and after segments', () => {
  const result = splitLeaveRangeForPartialCancel(
    new Date('2026-09-01T00:00:00.000Z'),
    new Date('2026-09-10T00:00:00.000Z'),
    new Date('2026-09-03T00:00:00.000Z'),
    new Date('2026-09-05T00:00:00.000Z')
  );

  assert.deepEqual(
    result.map(({ startDate, endDate }) => [toLeaveDateKey(startDate), toLeaveDateKey(endDate)]),
    [
      ['2026-09-01', '2026-09-02'],
      ['2026-09-06', '2026-09-10'],
    ]
  );
});

test('partial cancel rejects a cancelled range that is completely outside the leave window', () => {
  assert.throws(
    () => splitLeaveRangeForPartialCancel(
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-10T00:00:00.000Z'),
      new Date('2026-08-29T00:00:00.000Z'),
      new Date('2026-08-30T00:00:00.000Z')
    ),
    /outside the leave window/
  );
});

test('partial cancel keeps only the remaining valid side when the selected range touches the boundary', () => {
  const result = splitLeaveRangeForPartialCancel(
    new Date('2026-09-01T00:00:00.000Z'),
    new Date('2026-09-10T00:00:00.000Z'),
    new Date('2026-09-01T00:00:00.000Z'),
    new Date('2026-09-10T00:00:00.000Z')
  );

  assert.deepEqual(result, []);
});
