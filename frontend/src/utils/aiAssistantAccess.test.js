import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canUseAiAssistant, AI_SUGGESTED_QUESTIONS } from './aiAssistantAccess.js';

test('assistant access allows every known role, excludes trainer view and reset sessions', () => {
  for (const role of ['admin', 'demo', 'subject_coordinator', 'trainer', 'manager', 'campus_manager', 'evaluator']) assert.equal(canUseAiAssistant({ role }), true);
  assert.equal(canUseAiAssistant({ role: 'unknown' }), false);
  assert.equal(canUseAiAssistant(null), false);
  assert.equal(canUseAiAssistant({ role: 'admin', impersonating: true }), false);
  assert.equal(canUseAiAssistant({ role: 'subject_coordinator', mustResetPassword: true }), false);
  assert.equal(AI_SUGGESTED_QUESTIONS.length, 3);
});
