import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDateInsideReplacementWindow,
  replacementWindowOverlapsRange,
} from '../../utils/bulkReplacementAttendance.js';
import { formatTrainerAttendanceOifDisplay, TRAINER_ATTENDANCE_TYPES } from '../../utils/trainerAttendanceTypes.js';

test('formats Other base attendance display', () => {
  assert.equal(
    formatTrainerAttendanceOifDisplay(TRAINER_ATTENDANCE_TYPES.OTHER_BASE, ''),
    'Other base'
  );
});

test('replacement window date membership is inclusive', () => {
  const window = {
    from: new Date(Date.UTC(2026, 7, 22)),
    to: new Date(Date.UTC(2026, 8, 5)),
  };
  assert.equal(isDateInsideReplacementWindow(window, '2026-08-22'), true);
  assert.equal(isDateInsideReplacementWindow(window, '2026-09-05'), true);
  assert.equal(isDateInsideReplacementWindow(window, '2026-08-21'), false);
  assert.equal(isDateInsideReplacementWindow(window, '2026-09-06'), false);
});

test('replacement window month overlap detection', () => {
  const window = {
    from: new Date(Date.UTC(2026, 7, 22)),
    to: new Date(Date.UTC(2026, 8, 5)),
  };
  assert.equal(
    replacementWindowOverlapsRange(window, '2026-08-01', '2026-08-31'),
    true
  );
  assert.equal(
    replacementWindowOverlapsRange(window, '2026-09-01', '2026-09-30'),
    true
  );
  assert.equal(
    replacementWindowOverlapsRange(window, '2026-07-01', '2026-07-31'),
    false
  );
});
