import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthOptions, getLatestReportMonthParts } from './studentTestReportDates.js';

test('report months follow the selected semester instead of a fixed global start', () => {
  const term = { startDate: '2027-01-05', endDate: '2027-05-30' };
  assert.deepEqual(buildMonthOptions(term, new Date('2027-08-01')).map((month) => month.value), ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05']);
  assert.deepEqual(getLatestReportMonthParts(term, new Date('2027-02-10')), { year: 2027, month: 2 });
  assert.deepEqual(buildMonthOptions(term, new Date('2026-11-10')), []);
});
