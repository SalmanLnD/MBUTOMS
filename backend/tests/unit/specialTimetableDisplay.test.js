import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTrainerTimetableGridOptions } from '../../../frontend/src/utils/trainerTimetableDisplay.js';
import { buildTimetableGrid } from '../../../frontend/src/utils/timetableGrid.js';
import { PHOTO_PUNCH_BETA_USER_IDS as frontendBeta } from '../../../frontend/src/utils/photoPunchAccess.js';
import { PHOTO_PUNCH_BETA_USER_IDS as backendBeta } from '../../utils/photoPunchAccess.js';

test('custom special classes keep actual times in cells and omit header times', () => {
  const schedules = [
    { day: 'Friday', startTime: '10:00', endTime: '12:00', subjectCode: '22CS102034', isSpecial: true },
    { day: 'Friday', startTime: '14:00', endTime: '17:00', subjectCode: '22CS102034', isSpecial: true },
  ];
  const subject = { code: '22CS102034', name: 'Python' };
  const options = resolveTrainerTimetableGridOptions({ trainer: { employeeId: '136407' }, visibleSchedules: schedules, allSubjects: [subject], selectedSubject: subject });
  assert.equal(options.showTimingsInCells, true);
  const grid = buildTimetableGrid(schedules, undefined, options.fixedSlots, { periodOnlyMode: options.showTimingsInCells });
  assert.ok(grid.timeSlots.every(slot => slot.subLabel === ''));
  assert.equal(grid.cells['Friday|S1'].startTime, '10:00');
  assert.equal(grid.cells['Friday|S3'].endTime, '17:00');
});

test('frontend and API share the same punch-in beta access list', () => {
  assert.deepEqual(frontendBeta, backendBeta);
});
