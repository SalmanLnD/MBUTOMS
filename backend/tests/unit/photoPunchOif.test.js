import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhotoPunchOif } from '../../utils/photoPunchOif.js';

test('scheduled punch derives unique commercial OIFs and hours from effective timetable', () => {
  const result = resolvePhotoPunchOif({}, { totalHours: 4, schedules: [{subjectCode:'CT27004'}, {subjectCode:'CT27005'}, {subjectCode:'CT27004'}] });
  assert.equal(result.oifNumber, 'CT27004, CT27005');
  assert.equal(result.classHandlingHours, 4);
  assert.equal(resolvePhotoPunchOif().oifNumber, '');
});
test('manual OIF requires explicit valid hours; IT and capsule use attendance codes', () => {
  assert.equal(resolvePhotoPunchOif({mode:'it'}).oifNumber, 'IT');
  assert.equal(resolvePhotoPunchOif({mode:'capsule'}).oifNumber, 'CA26421');
  assert.deepEqual(resolvePhotoPunchOif({mode:'other',oifNumber:'XX123',classHandlingHours:2,mockPrepHours:3}), {oifEntryMode:'other',oifNumber:'XX123',classHandlingHours:2,mockPrepHours:3});
  assert.throws(() => resolvePhotoPunchOif({mode:'other',oifNumber:'XX123'}));
  assert.throws(() => resolvePhotoPunchOif({mode:'other',oifNumber:'XX123',classHandlingHours:20,mockPrepHours:8}));
  assert.throws(() => resolvePhotoPunchOif({mode:'unknown'}));
});
