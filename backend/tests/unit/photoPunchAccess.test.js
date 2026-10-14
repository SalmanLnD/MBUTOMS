import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canUsePhotoPunch } from '../../utils/photoPunchAccess.js';
import { canUsePhotoPunch as frontendCanUse } from '../../../frontend/src/utils/photoPunchAccess.js';

test('punch-in is open to trainers, coordinators, evaluators and admins', () => {
  for (const role of ['trainer', 'subject_coordinator', 'evaluator', 'admin']) {
    assert.equal(canUsePhotoPunch({ _id: 'any', role }), true);
    assert.equal(frontendCanUse({ _id: 'any', role }), true);
  }
  assert.equal(canUsePhotoPunch({ _id: 'any', role: 'manager' }), false);
  assert.equal(canUsePhotoPunch({ _id: 'any', role: 'campus_manager' }), false);
  assert.equal(frontendCanUse({ _id: 'any', role: 'manager' }), false);
});
