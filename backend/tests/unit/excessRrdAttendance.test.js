import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttendanceWeekdayName, normalizeAttendanceDate } from '../../utils/attendanceDates.js';
import {
  collectRrdDateKeys,
  planExcessRrdAttendanceTypes,
} from '../../utils/replacementRequiredDays.js';
import { buildCanceledScheduleIdsByDate } from '../../utils/leaveAffectedClasses.js';

test('first RRD in a month stays Leave and later RRDs default to E-Leave', () => {
  const planned = planExcessRrdAttendanceTypes([
    '2026-09-29',
    '2026-09-03',
    '2026-09-04',
  ]);
  assert.deepEqual(planned.leaveKeys, ['2026-09-03']);
  assert.deepEqual(planned.eLeaveKeys, ['2026-09-04', '2026-09-29']);
});

test('a later leave in a month with an existing RRD marks every new RRD as E-Leave', () => {
  const planned = planExcessRrdAttendanceTypes(
    ['2026-09-10', '2026-09-11'],
    new Map([['2026-09', 1]])
  );
  assert.deepEqual(planned.leaveKeys, []);
  assert.deepEqual(planned.eLeaveKeys, ['2026-09-10', '2026-09-11']);
});

test('RRD dates in two months each keep their own first Leave day', () => {
  const planned = planExcessRrdAttendanceTypes([
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
  ]);
  assert.deepEqual(planned.leaveKeys, ['2026-08-31', '2026-09-01']);
  assert.deepEqual(planned.eLeaveKeys, ['2026-09-02']);
});

test('cancelled class days are not RRD date keys', () => {
  const thursday = normalizeAttendanceDate('2026-09-03');
  assert.equal(getAttendanceWeekdayName(thursday), 'Thursday');
  const schedules = [
    { _id: { toString: () => 'thu-1' }, day: 'Thursday' },
    { _id: { toString: () => 'tue-1' }, day: 'Tuesday' },
  ];
  const cancellationMap = buildCanceledScheduleIdsByDate([{
    date: '2026-09-03',
    schedules: [schedules[0]],
  }]);

  assert.deepEqual(
    collectRrdDateKeys({
      dates: [thursday, normalizeAttendanceDate('2026-09-29')],
      leaveDateKeys: new Set(['2026-09-03', '2026-09-29']),
      schedules,
      holidayMap: new Map(),
      cancellationMap,
    }),
    ['2026-09-29']
  );
});
