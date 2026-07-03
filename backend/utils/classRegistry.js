import ClassGroup from '../models/ClassGroup.js';

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

export const semesterNumberToRoman = (number) =>
  ROMAN_BY_NUMBER[number] || String(number || 'III');

export const semesterNameToRoman = (name, number) => {
  if (number && ROMAN_BY_NUMBER[number]) return ROMAN_BY_NUMBER[number];
  const text = String(name || '');
  const order = ['VIII', 'VII', 'VI', 'IV', 'III', 'II', 'V', 'I'];
  return order.find((roman) => text.includes(roman)) || 'III';
};

export const defaultPyForSemester = (semesterRoman) => {
  const map = {
    I: 2030,
    II: 2030,
    III: 2029,
    IV: 2029,
    V: 2028,
    VI: 2028,
    VII: 2027,
    VIII: 2027,
  };
  return map[String(semesterRoman || '').trim()] ?? 2029;
};

export const findActiveClass = async ({ department, section, semester }) => {
  const dept = String(department || '').trim();
  const sect = String(section || '').trim();
  if (!dept || !sect) return null;

  const filter = {
    department: dept,
    section: sect,
    status: 'active',
  };

  if (semester) {
    filter.currentSemester = String(semester).trim();
  }

  return ClassGroup.findOne(filter);
};

export const assertClassRegistered = async ({ department, section, semester }) => {
  const dept = String(department || '').trim();
  const sect = String(section || '').trim();
  const sem = String(semester || '').trim();

  const match = await findActiveClass({ department: dept, section: sect, semester: sem })
    || await findActiveClass({ department: dept, section: sect });

  if (!match) {
    const error = new Error(
      `Class "${dept} ${sect}" is not registered. Add it under Classes & Students first.`
    );
    error.statusCode = 400;
    throw error;
  }

  if (sem && match.currentSemester !== sem) {
    const error = new Error(
      `Class "${dept} ${sect}" is registered for semester ${match.currentSemester}, not ${sem}.`
    );
    error.statusCode = 400;
    throw error;
  }

  return match;
};

export const syncClassPyBySemester = async () => {
  const classes = await ClassGroup.find();
  let updated = 0;
  let skipped = 0;

  for (const cls of classes) {
    const expectedPy = defaultPyForSemester(cls.currentSemester);
    if (cls.py === expectedPy) {
      skipped += 1;
      continue;
    }

    cls.py = expectedPy;
    await cls.save();
    updated += 1;
  }

  return { updated, skipped, total: classes.length };
};
