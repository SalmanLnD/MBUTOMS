/** Default PLP component weightages (percent). Must total 100. */
export const PLP_WEIGHTAGES = {
  feedback: 30,
  classObservation: 25,
  demoObservation: 20,
  attendance: 15,
  compliance: 10,
};

export const PLP_ATTENDANCE_DEFAULT = 4;
export const PLP_COMPLIANCE_DEFAULT = 5;
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

export const complianceScoreFromCount = (count = 0) =>
  Math.max(0, PLP_COMPLIANCE_DEFAULT - Math.max(0, Number(count) || 0));

/**
 * Weighted final PLP rating (raw, before half-rounding / clamp).
 * Null components are excluded and remaining weights are renormalized.
 */
export const computePlpFinalRating = (scores = {}, weightages = PLP_WEIGHTAGES) => {
  let weighted = 0;
  let totalWeight = 0;

  Object.entries(weightages).forEach(([key, weight]) => {
    const value = scores[key];
    if (value == null || !Number.isFinite(Number(value))) return;
    const w = Number(weight) || 0;
    if (w <= 0) return;
    weighted += Number(value) * w;
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
});
