import { plpCycleUsesUpdatedRules } from './plpCycles.js';

/** Default PLP component weightages (percent). Must total 100. */
export const PLP_WEIGHTAGES = {
  feedback: 30,
  classObservation: 25,
  demoObservation: 20,
  attendance: 15,
  compliance: 10,
};

export const PLP_ATTENDANCE_DEFAULT = 4;
/** Historical compliance start, used before the September–October 2026 cycle. */
export const PLP_COMPLIANCE_DEFAULT = 5;
/** Compliance start from September–October 2026 onward. Still out of 5. */
export const PLP_COMPLIANCE_DEFAULT_UPDATED = 4;
export const PLP_FINAL_MIN = 3.5;
export const PLP_FINAL_MAX = 4.5;

export const PLP_WEIGHTAGE_KEYS = [
  'feedback',
  'classObservation',
  'demoObservation',
  'attendance',
  'compliance',
];

export const roundPlpScore = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
};

/** Round to nearest 0.5 (e.g. 3.74 → 3.5, 3.75 → 4.0). */
export const roundToHalf = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 2) / 2;
};

export const clampPlpFinal = (value) => {
  const rounded = roundToHalf(value);
  if (rounded == null) return null;
  return Math.min(PLP_FINAL_MAX, Math.max(PLP_FINAL_MIN, rounded));
};

export const attendanceScoreFromRrd = (rrdDays = 0) =>
  Math.max(0, PLP_ATTENDANCE_DEFAULT - Math.max(0, Number(rrdDays) || 0));

export const complianceDefaultForCycle = (cycleKey) =>
  (plpCycleUsesUpdatedRules(cycleKey) ? PLP_COMPLIANCE_DEFAULT_UPDATED : PLP_COMPLIANCE_DEFAULT);

/**
 * Starts at 5 before September–October 2026, and at 4 from that cycle on.
 * Each compliance record removes 1. The score cannot go below 0.
 */
export const complianceScoreFromCount = (count = 0, cycleKey) =>
  Math.max(0, complianceDefaultForCycle(cycleKey) - Math.max(0, Number(count) || 0));

/**
 * Response-count adjustment applied to a trainer's average feedback.
 * More than 100 responses: use the average as scored.
 * 76–100: subtract 0.25. 51–75: subtract 0.5. 50 or fewer: subtract 1.
 * Counts of 100, 75, and 50 fall in the next lower band.
 */
export const feedbackResponseDeduction = (responseCount = 0) => {
  const count = Math.max(0, Number(responseCount) || 0);
  if (count > 100) return 0;
  if (count > 75) return 0.25;
  if (count > 50) return 0.5;
  return 1;
};

/** Feedback component used in the PLP average. Missing ratings stay null. */
export const feedbackScoreForPlp = (average, responseCount = 0, cycleKey) => {
  if (average == null || !Number.isFinite(Number(average))) return null;
  const base = Number(average);
  if (!plpCycleUsesUpdatedRules(cycleKey)) return roundPlpScore(base);
  return roundPlpScore(Math.max(0, base - feedbackResponseDeduction(responseCount)));
};

/**
 * Weighted final PLP rating (raw, before half-rounding / clamp).
 * Missing feedback / class / demo (null) count as 0 so their weightage still
 * pulls the average down instead of being redistributed.
 */
export const computePlpFinalRating = (scores = {}, weightages = PLP_WEIGHTAGES) => {
  let weighted = 0;
  let totalWeight = 0;

  PLP_WEIGHTAGE_KEYS.forEach((key) => {
    const w = Number(weightages[key]) || 0;
    if (w <= 0) return;
    const raw = scores[key];
    const value = raw == null || !Number.isFinite(Number(raw)) ? 0 : Number(raw);
    weighted += value * w;
    totalWeight += w;
  });

  if (!totalWeight) return null;
  return roundPlpScore(weighted / totalWeight);
};

export const computeDisplayPlpFinal = (scores = {}, weightages = PLP_WEIGHTAGES) =>
  clampPlpFinal(computePlpFinalRating(scores, weightages));

export const normalizeWeightages = (input = {}) => {
  const next = { ...PLP_WEIGHTAGES };
  PLP_WEIGHTAGE_KEYS.forEach((key) => {
    if (input[key] == null || input[key] === '') return;
    const value = Number(input[key]);
    if (Number.isFinite(value) && value >= 0) {
      next[key] = Math.round(value * 100) / 100;
    }
  });
  return next;
};

export const weightagesTotal = (weightages = PLP_WEIGHTAGES) =>
  PLP_WEIGHTAGE_KEYS.reduce((sum, key) => sum + (Number(weightages[key]) || 0), 0);

export const plpWeightageLabels = (weightages = PLP_WEIGHTAGES) => ({
  feedback: `Feedback (${weightages.feedback}%)`,
  classObservation: `Class observation (${weightages.classObservation}%)`,
  demoObservation: `Demo observation (${weightages.demoObservation}%)`,
  attendance: `Attendance (${weightages.attendance}%)`,
  compliance: `Compliance (${weightages.compliance}%)`,
  finalRating: 'Final PLP rating',
  actualFinal: 'Actual',
  roundedFinal: 'Rounded',
});
