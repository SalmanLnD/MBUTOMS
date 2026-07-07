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

const ROMAN_BY_NUMBER = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};

const ROMAN_SEARCH_ORDER = ['VIII', 'VII', 'VI', 'IV', 'III', 'II', 'V', 'I'];

export const defaultPyForSemester = (semester) =>
  PY_BY_SEMESTER[String(semester || '').trim()] ?? 2029;

export const semesterNumberToRoman = (number) =>
  ROMAN_BY_NUMBER[number] || null;

export const semesterNameToRoman = (name, number) => {
  const fromNumber = semesterNumberToRoman(number);
  if (fromNumber) return fromNumber;
  const text = String(name || '');
  return ROMAN_SEARCH_ORDER.find((roman) => text.includes(roman)) || null;
};

export const getSubjectSemesterRoman = (subject) =>
  semesterNameToRoman(subject?.semester?.name, subject?.semester?.number);
