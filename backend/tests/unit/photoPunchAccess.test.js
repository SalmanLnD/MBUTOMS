import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canUsePhotoPunch} from '../../utils/photoPunchAccess.js';
test('punch-in beta grants only Laxmi Priya and admins', () => {
  assert.equal(canUsePhotoPunch({_id:'6a508b8f7e83de4ee7da30e9',role:'trainer'}),true);
  assert.equal(canUsePhotoPunch({_id:'someone',role:'admin'}),true);
  assert.equal(canUsePhotoPunch({_id:'other',role:'trainer'}),false);
  assert.equal(canUsePhotoPunch({_id:'other',role:'manager'}),false);
});
