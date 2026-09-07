import test from 'node:test';
import assert from 'node:assert/strict';

import { splitLeaveRangeForPartialCancel } from '../../utils/leaveRangeSplit.js';
import { toLeaveDateKey } from '../../utils/leaveDateRange.js';

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
