import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttendanceExportMonthKeys } from '../../utils/trainerAttendanceExport.js';

test('attendance export months start in July 2026 and end at the current month', () => {
  const months = getAttendanceExportMonthKeys();
  assert.equal(months[0], '2026-07');
  assert.ok(months.length >= 1);
  assert.equal(new Set(months).size, months.length);

  const now = new Date();
  const expectedEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  assert.equal(months[months.length - 1], expectedEnd);
});
