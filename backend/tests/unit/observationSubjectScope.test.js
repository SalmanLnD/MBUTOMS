import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getObservationSubjectIds,
  hasEvaluatorObservationAccess,
} from '../../utils/evaluatorAccess.js';

test('coordinator observation scope includes coordinator subjects', () => {
  const user = {
    role: 'subject_coordinator',
    coordinatorSubjects: ['lrre', 'qava'],
    evaluatorSubjects: ['lrre'],
  };

  assert.deepEqual(getObservationSubjectIds(user).sort(), ['lrre', 'qava']);
  assert.equal(hasEvaluatorObservationAccess(user), true);
});

test('a coordinator with only coordinator subjects can open observations', () => {
  const user = {
    role: 'subject_coordinator',
    coordinatorSubjects: ['qava'],
    evaluatorSubjects: [],
  };

  assert.deepEqual(getObservationSubjectIds(user), ['qava']);
  assert.equal(hasEvaluatorObservationAccess(user), true);
});
