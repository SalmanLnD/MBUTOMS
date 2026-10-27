import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLP_WEIGHTAGES,
  attendanceScoreFromRrd,
  clampPlpFinal,
  complianceScoreFromCount,
  computeDisplayPlpFinal,
  computePlpFinalRating,
  feedbackResponseDeduction,
  feedbackScoreForPlp,
  roundToHalf,
} from '../../utils/plpScoring.js';
import {
  cycleKeyForAttendanceDate,
  getPlpCycleRange,
  observationBelongsToCycle,
} from '../../utils/plpCycles.js';

test('attendance score defaults to 4 and deducts RRD days', () => {
  assert.equal(attendanceScoreFromRrd(0), 4);
  assert.equal(attendanceScoreFromRrd(1), 3);
  assert.equal(attendanceScoreFromRrd(4), 0);
  assert.equal(attendanceScoreFromRrd(9), 0);
});

test('compliance score defaults to 5 before September-October and deducts per record', () => {
  assert.equal(complianceScoreFromCount(0), 5);
  assert.equal(complianceScoreFromCount(0, '2026-09'), 5);
  assert.equal(complianceScoreFromCount(2), 3);
  assert.equal(complianceScoreFromCount(5), 0);
  assert.equal(complianceScoreFromCount(8), 0);
});

test('September-October compliance starts at 4; later cycles retain their default', () => {
  assert.equal(complianceScoreFromCount(0, '2026-10'), 4);
  assert.equal(complianceScoreFromCount(1, '2026-10'), 3);
  assert.equal(complianceScoreFromCount(4, '2026-10'), 0);
  assert.equal(complianceScoreFromCount(0, '2026-11'), 4);
  assert.equal(complianceScoreFromCount(6, '2026-11'), 0);
  assert.equal(cycleKeyForAttendanceDate('2026-09-20'), '2026-09');
  assert.equal(cycleKeyForAttendanceDate('2026-09-21'), '2026-10');
});

test('feedback response count adjusts the PLP score from September-October', () => {
  assert.equal(feedbackResponseDeduction(101), 0);
  assert.equal(feedbackResponseDeduction(99), 0.25);
  assert.equal(feedbackResponseDeduction(74), 0.35);
  assert.equal(feedbackResponseDeduction(49), 0.50);
  assert.equal(feedbackResponseDeduction(100), 0);
  assert.equal(feedbackResponseDeduction(76), 0.25);
  assert.equal(feedbackResponseDeduction(75), 0.25);
  assert.equal(feedbackResponseDeduction(51), 0.35);
  assert.equal(feedbackResponseDeduction(50), 0.35);
  assert.equal(feedbackResponseDeduction(12), 0.5);

  assert.equal(feedbackScoreForPlp(4.5, 140, '2026-10'), 4.5);
  assert.equal(feedbackScoreForPlp(4.5, 90, '2026-10'), 4.25);
  assert.equal(feedbackScoreForPlp(4.5, 60, '2026-10'), 4.15);
  assert.equal(feedbackScoreForPlp(4.2, 40, '2026-10'), 3.7);
  assert.equal(feedbackScoreForPlp(0.4, 10, '2026-10'), 0);
  assert.equal(feedbackScoreForPlp(4.2, 40, '2026-09'), 4.2);
  assert.equal(feedbackScoreForPlp(null, 10, '2026-10'), null);
});

test('final PLP rating uses weightages and treats missing components as zero', () => {
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

  // Missing demo (20%) and class (25%) count as 0, not skipped.
  // (4*30 + 0*25 + 0*20 + 4*15 + 5*10) / 100 = 2.30
  const partial = computePlpFinalRating({
    feedback: 4,
    classObservation: null,
    demoObservation: null,
    attendance: 4,
    compliance: 5,
  });
  assert.equal(partial, 2.3);

  // Only attendance + compliance present: still full 100% denominator.
  // (0*30 + 0*25 + 0*20 + 4*15 + 5*10) / 100 = 1.10
  const sparse = computePlpFinalRating({
    feedback: null,
    classObservation: null,
    demoObservation: null,
    attendance: 4,
    compliance: 5,
  });
  assert.equal(sparse, 1.1);
  assert.equal(computeDisplayPlpFinal({
    feedback: null,
    classObservation: null,
    demoObservation: null,
    attendance: 4,
    compliance: 5,
  }), 3.5);
});

test('display final rounds to 0.5 and clamps between 3.5 and 4.5', () => {
  assert.equal(roundToHalf(3.74), 3.5);
  assert.equal(roundToHalf(3.75), 4);
  assert.equal(clampPlpFinal(2), 3.5);
  assert.equal(clampPlpFinal(5), 4.5);
  assert.equal(clampPlpFinal(4.1), 4);

  const display = computeDisplayPlpFinal({
    feedback: 5,
    classObservation: 5,
    demoObservation: 5,
    attendance: 5,
    compliance: 5,
  });
  assert.equal(display, 4.5);
});

test('PLP cycle 2026-07 is 21 Jun through 20 Jul with July feedback month', () => {
  const cycle = getPlpCycleRange('2026-07');
  assert.equal(cycle.startKey, '2026-06-21');
  assert.equal(cycle.endKey, '2026-07-20');
  assert.equal(cycle.feedbackMonthKey, '2026-07');
  assert.deepEqual(cycle.observationMonthKeys, ['2026-06', '2026-07']);
  assert.equal(cycle.sheetName, 'June-July 2026');
});

test('PLP cycle sheet names use full month names with end-year', () => {
  assert.equal(getPlpCycleRange('2026-08').sheetName, 'July-August 2026');
  assert.equal(getPlpCycleRange('2027-01').sheetName, 'December-January 2027');
});

test('observations are placed in the 21–20 cycle containing their date', () => {
  const cycle = getPlpCycleRange('2026-07');
  assert.equal(
    observationBelongsToCycle({ monthKey: '2026-06', observationDate: '2026-06-25' }, cycle),
    true
  );
  assert.equal(
    observationBelongsToCycle({ monthKey: '2026-07', observationDate: '2026-07-20' }, cycle),
    true
  );
  assert.equal(
    observationBelongsToCycle({ monthKey: '2026-07', observationDate: '2026-07-21' }, cycle),
    false
  );
  assert.equal(
    observationBelongsToCycle({ monthKey: '2026-06', observationDate: '2026-06-20' }, cycle),
    false
  );
});

test('undated observations fall back to the cycle keyed by their month', () => {
  const cycle = getPlpCycleRange('2026-07');
  assert.equal(observationBelongsToCycle({ monthKey: '2026-07', observationDate: '' }, cycle), true);
  assert.equal(observationBelongsToCycle({ monthKey: '2026-06' }, cycle), false);
});
