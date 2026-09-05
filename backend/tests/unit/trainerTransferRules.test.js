import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRequirePermanentReplacement } from '../../utils/trainerTransferRules.js';

test('exit without assigned classes does not require permanent replacement', () => {
  assert.equal(shouldRequirePermanentReplacement({ mode: 'resign', hasAssignedClasses: false }), false);
  assert.equal(shouldRequirePermanentReplacement({ mode: 'relocate', hasAssignedClasses: false }), false);
});

test('exit with assigned classes requires permanent replacement', () => {
  assert.equal(shouldRequirePermanentReplacement({ mode: 'resign', hasAssignedClasses: true }), true);
  assert.equal(shouldRequirePermanentReplacement({ mode: 'relocate', hasAssignedClasses: true }), true);
});

test('direct permanent replacement always requires a replacement trainer', () => {
  assert.equal(shouldRequirePermanentReplacement({ mode: 'replacement', hasAssignedClasses: false }), true);
  assert.equal(shouldRequirePermanentReplacement({ mode: 'replacement', hasAssignedClasses: true }), true);
});
