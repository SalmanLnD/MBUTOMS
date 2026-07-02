export const IDSA_TRAINER_NAMES = {
  'IDSA-T1': 'Sharmila',
  'IDSA-T2': 'Navya',
  'IDSA-T3': 'Jahnvi',
  'IDSA-T4': 'Vasanth',
  'IDSA-T5': 'Divya',
  'IDSA-T6': 'Lavanya',
  'IDSA-T7': 'Vyshnavi',
};

export const IDSA_SUBJECT = {
  code: '22CS102033',
  name: 'Industry Data Structures and Algorithms',
};

export const IDSA_DEPARTMENT_CODES = ['CSE', 'AIML', 'DS', 'IT', 'CS', 'AI&DS'];

export const PEDH_TRAINER_NAMES = {
  'PEDH- T01': 'PEDH- T01',
  'PEDH- T02': 'PEDH- T02',
  'PEDH- T03': 'PEDH- T03',
  'PEDH- T04': 'PEDH- T04',
  'PEDH- T05': 'PEDH- T05',
  'PEDH- T06': 'PEDH- T06',
  'PEDH- T07': 'Sai Priya',
};

export const PEDH_SUBJECT = {
  code: '22CS102037',
  name: 'Python Essentials and Data Handling',
};

export const PEDH_DEPARTMENT_CODES = ['CSE', 'AIML', 'DS', 'IT', 'CS', 'AI&DS'];

export const SAI_PRIYA_TRAINER_CODE = 'PEDH- T07';

export const DSAP_SUBJECT = {
  code: '25CA202009',
  name: 'Data Structures and Algorithms with Python',
};

export const resolveSaiPriyaSubjectCode = ({ department, section }) => {
  const dept = String(department || '').trim();
  const sect = String(section || '').trim();

  if (dept === 'MCA' || sect.toLowerCase().startsWith('mca')) {
    return DSAP_SUBJECT.code;
  }
  if (PEDH_DEPARTMENT_CODES.includes(dept)) {
    return PEDH_SUBJECT.code;
  }
  return null;
};

export const getTrainerDisplayName = (employeeId) =>
  IDSA_TRAINER_NAMES[employeeId] || PEDH_TRAINER_NAMES[employeeId] || employeeId;

const normalizeName = (value) =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const nameStem = (value) => normalizeName(value).replace(/[aeiou]/g, '');

const stemsMatch = (left, right) => {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 4 && right.length >= 4) {
    return left.includes(right) || right.includes(left);
  }
  return false;
};

const MIN_NAME_PART_LENGTH = 3;

const isPlaceholderLegacyName = (code, legacyName) =>
  String(legacyName || '').trim() === String(code || '').trim();

const getNameParts = (name) =>
  String(name || '')
    .toLowerCase()
    .split(/\s+/)
    .map((part) => normalizeName(part))
    .filter((part) => part.length >= MIN_NAME_PART_LENGTH);

const partMatchesLegacyToken = (trainerPart, legacyPart) => {
  if (!trainerPart || !legacyPart) return false;
  if (trainerPart === legacyPart) return true;
  if (trainerPart.includes(legacyPart) || legacyPart.includes(trainerPart)) {
    return legacyPart.length >= MIN_NAME_PART_LENGTH && trainerPart.length >= MIN_NAME_PART_LENGTH;
  }
  return stemsMatch(nameStem(trainerPart), nameStem(legacyPart));
};

const trainerNameMatchesLegacy = (trainerName, legacyName) => {
  const trainer = normalizeName(trainerName);
  const legacy = normalizeName(legacyName);
  if (!trainer || !legacy) return false;

  const trainerParts = getNameParts(trainerName);
  const legacyParts = getNameParts(legacyName);

  if (legacyParts.length > 1) {
    return legacyParts.every((legacyPart) =>
      trainerParts.some((trainerPart) => partMatchesLegacyToken(trainerPart, legacyPart))
    );
  }

  if (trainer.length >= MIN_NAME_PART_LENGTH && legacy.length >= MIN_NAME_PART_LENGTH) {
    if (trainer.includes(legacy) || legacy.includes(trainer)) return true;
  }

  return trainerParts.some((part) => partMatchesLegacyToken(part, legacy));
};

export const resolveTrainerScheduleCodes = (trainer) => {
  const codes = new Set();
  if (!trainer) return [];

  if (trainer.employeeId) codes.add(trainer.employeeId);

  const allLegacyMaps = [IDSA_TRAINER_NAMES, PEDH_TRAINER_NAMES];

  allLegacyMaps.forEach((legacyMap) => {
    Object.entries(legacyMap).forEach(([code, legacyName]) => {
      if (trainer.employeeId === code) {
        codes.add(code);
      }
      if (isPlaceholderLegacyName(code, legacyName)) return;
      if (trainerNameMatchesLegacy(trainer.name, legacyName)) {
        codes.add(code);
      }
    });
  });

  return [...codes];
};
