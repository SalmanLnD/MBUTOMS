import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeRetryMethod } from './retryPolicy.js';
test('retry policy never automatically repeats mutations', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isSafeRetryMethod(method), false);
  for (const method of ['GET', 'head', 'options', undefined]) assert.equal(isSafeRetryMethod(method), true);
});
