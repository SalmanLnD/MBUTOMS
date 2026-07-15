import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countsAsOifDay,
  resolveClassHandlingHoursForOif,
  resolveMockPrepHoursForOif,
} from '../../utils/attendanceOifRules.js';

test('internal training does not count as an OIF day or class hours', () => {
  assert.equal(countsAsOifDay('IT'), false);
  assert.equal(countsAsOifDay(' it '), false);
  assert.equal(countsAsOifDay('IT ca26421'), false);
  assert.equal(countsAsOifDay('it-ca26421'), false);
  assert.equal(resolveMockPrepHoursForOif('IT', 0), 7);
  assert.equal(resolveMockPrepHoursForOif('IT ca26421', 0), 7);
  assert.equal(resolveClassHandlingHoursForOif('IT', 3), 0);
  assert.equal(resolveClassHandlingHoursForOif('IT ca26421', 3), 0);
});

test('normal OIF numbers still count as OIF days', () => {
  assert.equal(countsAsOifDay('OIF-123'), true);
  assert.equal(countsAsOifDay(''), false);
});
