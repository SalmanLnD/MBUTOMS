import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLP_WEIGHTAGES,
  attendanceScoreFromRrd,
  complianceScoreFromCount,
  computePlpFinalRating,
} from '../../utils/plpScoring.js';

test('attendance score defaults to 4 and deducts RRD days', () => {
  assert.equal(attendanceScoreFromRrd(0), 4);
  assert.equal(attendanceScoreFromRrd(1), 3);
  assert.equal(attendanceScoreFromRrd(4), 0);
  assert.equal(attendanceScoreFromRrd(9), 0);
});

test('compliance score defaults to 5 and deducts per record', () => {
  assert.equal(complianceScoreFromCount(0), 5);
  assert.equal(complianceScoreFromCount(2), 3);
  assert.equal(complianceScoreFromCount(5), 0);
  assert.equal(complianceScoreFromCount(8), 0);
});

test('final PLP rating uses weightages and skips null components', () => {
  const total = Object.values(PLP_WEIGHTAGES).reduce((sum, value) => sum + value, 0);
  assert.equal(total, 100);

  const full = computePlpFinalRating({
    feedback: 5,
    classObservation: 5,
    demoObservation: 5,
    attendance: 5,
    compliance: 5,
  });
  assert.equal(full, 5);

  const partial = computePlpFinalRating({
    feedback: 4,
    classObservation: null,
    demoObservation: null,
    attendance: 4,
    compliance: 5,
  });
  // (4*30 + 4*15 + 5*10) / (30+15+10) = 230/55
  assert.equal(partial, Math.round((230 / 55) * 100) / 100);
});
