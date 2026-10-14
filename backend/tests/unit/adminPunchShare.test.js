import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPunchShareCaption, MANAGERS_ATTENDANCE_GROUP } from '../../utils/adminPunchShare.js';

test('admin punch share caption names the trainer, OIF and India time', () => {
  const caption = buildAdminPunchShareCaption({
    name: 'Salman',
    oifNumber: 'CA26421',
    capturedAt: '2026-10-13T04:30:00.000Z',
  });
  assert.match(caption, /^Admin punch-in\nSalman\nOIF CA26421\n/);
  assert.match(caption, /10:00/);
  assert.equal(MANAGERS_ATTENDANCE_GROUP, 'FACE Prep | Attendance tracking | Training Managers');
});
