import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttendanceExportMonthKeys } from '../../utils/trainerAttendanceExport.js';

test('attendance sheet includes July 2026 through January 2027', () => {
  const months = getAttendanceExportMonthKeys();
  assert.equal(months[0], '2026-07');
  assert.ok(months.includes('2027-01'));
  assert.equal(new Set(months).size, months.length);
});
