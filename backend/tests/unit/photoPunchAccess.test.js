import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canUsePhotoPunch} from '../../utils/photoPunchAccess.js';
test('punch-in beta grants invited trainers and coordinators plus admins', () => {
  assert.equal(canUsePhotoPunch({_id:'6a508b8f7e83de4ee7da30e9',role:'trainer'}),true);
  assert.equal(canUsePhotoPunch({_id:'6a508b8b7e83de4ee7da3096',role:'subject_coordinator'}),true);
  assert.equal(canUsePhotoPunch({_id:'6a508b8d7e83de4ee7da30b9',role:'trainer'}),true);
  assert.equal(canUsePhotoPunch({_id:'someone',role:'admin'}),true);
  assert.equal(canUsePhotoPunch({_id:'other',role:'trainer'}),false);
  assert.equal(canUsePhotoPunch({_id:'other',role:'manager'}),false);
});
