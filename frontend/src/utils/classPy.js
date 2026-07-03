const PY_BY_SEMESTER = {
  I: 2030,
  II: 2030,
  III: 2029,
  IV: 2029,
  V: 2028,
  VI: 2028,
  VII: 2027,
  VIII: 2027,
};

export const defaultPyForSemester = (semester) =>
  PY_BY_SEMESTER[String(semester || '').trim()] ?? 2029;
