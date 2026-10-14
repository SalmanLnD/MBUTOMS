import test from 'node:test';
import assert from 'node:assert/strict';
import { isProtectedRouteAllowed } from './roles.js';

test('a signed-in route with no role list stays open', () => {
  assert.equal(isProtectedRouteAllowed({ role: 'admin' }), true);
  assert.equal(isProtectedRouteAllowed({ roles: undefined, role: 'trainer' }), true);
});

test('exact punch access does not inherit campus manager from subject coordinator', () => {
  const roles = ['admin', 'trainer', 'subject_coordinator', 'evaluator'];
  assert.equal(isProtectedRouteAllowed({ roles, exact: true, role: 'trainer' }), true);
  assert.equal(isProtectedRouteAllowed({ roles, exact: true, role: 'campus_manager' }), false);
  assert.equal(isProtectedRouteAllowed({ roles, exact: false, role: 'campus_manager' }), true);
});
