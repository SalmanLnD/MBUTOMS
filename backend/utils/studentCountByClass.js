const SEMESTER_NUMBER_BY_LABEL = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
};

const SEMESTER_LABEL_BY_NUMBER = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};

/** Normalize semester labels so III / 3 / Sem III map to the same key. */
export const normalizeSemesterKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && SEMESTER_LABEL_BY_NUMBER[asNumber]) {
    return SEMESTER_LABEL_BY_NUMBER[asNumber];
  }

  const cleaned = raw
    .replace(/semester|sem/gi, '')
    .trim()
    .toLowerCase();
  const number = SEMESTER_NUMBER_BY_LABEL[cleaned];
  return number ? SEMESTER_LABEL_BY_NUMBER[number] : raw.toUpperCase();
};

export const buildStudentCountKey = (department, section, semester) => {
  const semesterKey = normalizeSemesterKey(semester);
  return `${department}::${section}::${semesterKey}`;
};

/**
 * Look up active student headcount for a class department + section + semester.
 * Handles combined class labels that store students under constituent branches.
 */
export const getStudentCountForClass = (countMap, department, section, semester) => {
  if (!department || section == null || section === '') return 0;
  if (!normalizeSemesterKey(semester)) return 0;

  const key = (dept) => buildStudentCountKey(dept, section, semester);
  const direct = countMap.get(key(department));
  if (direct) return direct;

  if (department === 'ECE & EIE') {
    return (countMap.get(key('ECE')) || 0) + (countMap.get(key('EIE')) || 0);
  }

  if (department === 'CE & ME' || department === 'CE-ME') {
    return countMap.get(key('CE-ME'))
      || countMap.get(key('CE & ME'))
      || (countMap.get(key('CE')) || 0) + (countMap.get(key('ME')) || 0);
  }

  if (department === 'B.COM(CA)') {
    return countMap.get(key('BCOM-CA')) || 0;
  }

  if (department === 'BCOM-CA') {
    return countMap.get(key('B.COM(CA)')) || 0;
  }

  return 0;
};

/**
 * Prefer a manually saved positive total; otherwise use live class headcount.
 * Schema default 0 must not block auto-fill from class/student details.
 */
export const resolveAllottedStudents = (saved, liveCount) => {
  const savedNum = Number(saved);
  if (Number.isFinite(savedNum) && savedNum > 0) return savedNum;
  return Number(liveCount) || 0;
};
