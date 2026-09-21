import test from 'node:test';
import assert from 'node:assert/strict';
import { getDataRevision } from '../../utils/dataRevision.js';
import { clearAttendanceGridCache } from '../../utils/attendanceGridCache.js';
import {
  clearAttendanceExportCache,
} from '../../services/attendanceSheetsService.js';

test('attendance grid clears also invalidate Sheets export snapshots', () => {
  const before = getDataRevision();
  clearAttendanceExportCache();
  clearAttendanceGridCache();
  assert.ok(getDataRevision() > before);
});
