import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  canCreateLeaveForOthers,
  isTrainerLikeRole,
  isAuthorizedRole,
  FULL_ACCESS_ROLES,
  MANAGEMENT_ROLES,
} from '../../utils/roles.js';

test('subject coordinators are trainer-like for leave', () => {
  assert.equal(isTrainerLikeRole(ROLES.TRAINER), true);
  assert.equal(isTrainerLikeRole(ROLES.SUBJECT_COORDINATOR), true);
  assert.equal(isTrainerLikeRole(ROLES.ADMIN), false);
  assert.equal(isTrainerLikeRole(ROLES.MANAGER), false);
  assert.equal(isTrainerLikeRole(ROLES.CAMPUS_MANAGER), false);
});

test('only admin can create leave for other trainers', () => {
  assert.equal(canCreateLeaveForOthers(ROLES.ADMIN), true);
  assert.equal(canCreateLeaveForOthers(ROLES.MANAGER), false);
  assert.equal(canCreateLeaveForOthers(ROLES.CAMPUS_MANAGER), false);
  assert.equal(canCreateLeaveForOthers(ROLES.SUBJECT_COORDINATOR), false);
  assert.equal(canCreateLeaveForOthers(ROLES.TRAINER), false);
});

test('subject coordinators are not full-access leave approvers', () => {
  assert.equal(FULL_ACCESS_ROLES.includes(ROLES.SUBJECT_COORDINATOR), false);
  assert.equal(FULL_ACCESS_ROLES.includes(ROLES.ADMIN), true);
  assert.equal(FULL_ACCESS_ROLES.includes(ROLES.MANAGER), true);
  // Alias still maps coordinator ↔ campus_manager for broader authorize(),
  // but leave approve uses exact FULL_ACCESS membership.
  assert.equal(isAuthorizedRole(ROLES.SUBJECT_COORDINATOR, [ROLES.CAMPUS_MANAGER]), true);
  assert.equal(isAuthorizedRole(ROLES.SUBJECT_COORDINATOR, MANAGEMENT_ROLES), true);
});
