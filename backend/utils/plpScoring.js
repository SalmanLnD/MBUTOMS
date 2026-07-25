/** PLP component weightages (percent). Must total 100. */
export const PLP_WEIGHTAGES = {
  feedback: 30,
  classObservation: 25,
  demoObservation: 20,
  attendance: 15,
  compliance: 10,
};

export const PLP_ATTENDANCE_DEFAULT = 4;
export const PLP_COMPLIANCE_DEFAULT = 5;

export const roundPlpScore = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
};

export const attendanceScoreFromRrd = (rrdDays = 0) =>
  Math.max(0, PLP_ATTENDANCE_DEFAULT - Math.max(0, Number(rrdDays) || 0));

export const complianceScoreFromCount = (count = 0) =>
  Math.max(0, PLP_COMPLIANCE_DEFAULT - Math.max(0, Number(count) || 0));

/**
 * Weighted final PLP rating.
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

export const plpWeightageLabels = (weightages = PLP_WEIGHTAGES) => ({
  feedback: `Feedback (${weightages.feedback}%)`,
  classObservation: `Class observation (${weightages.classObservation}%)`,
  demoObservation: `Demo observation (${weightages.demoObservation}%)`,
  attendance: `Attendance (${weightages.attendance}%)`,
  compliance: `Compliance (${weightages.compliance}%)`,
  finalRating: 'Final PLP rating',
});
