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
  name: 'Industrial Data Structures and Algorithms',
  oifNumber: 'CT27004',
};

export const IDSA_DEPARTMENT_CODES = ['CSE', 'AIML', 'DS', 'IT', 'CS', 'AI&DS'];

export const ADMIN_TRAINER_EMPLOYEE_ID = '131665';

export const DSAP_SUBJECT = {
  code: '25CA202009',
  name: 'Data Structures and Algorithms Using Python',
  oifNumber: 'CT27008',
};

export const PSTP_TRAINER_NAMES = {
  'PSTP-T8': 'Ashwini',
  'PSTP-T9': 'Mahendra Urumu',
};

export const PSTP_SUBJECT = {
  code: '22CS102034',
  name: 'Problem Solving Through Python',
  oifNumber: 'CT27005',
};

export const PSTP_DEPARTMENT_CODES = ['ECE', 'EIE', 'EEE', 'CE'];

export const getTrainerDisplayName = (employeeId) =>
  IDSA_TRAINER_NAMES[employeeId]
  || PSTP_TRAINER_NAMES[employeeId]
  || employeeId;

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

export const isPlaceholderLegacyName = (code, legacyName) =>
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
  return stemsMatch(nameStem(trainerPart), nameStem(legacyPart));
};

export const trainerNameMatchesLegacy = (trainerName, legacyName) => {
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

  return legacyParts.some((legacyPart) =>
    trainerParts.some((trainerPart) => partMatchesLegacyToken(trainerPart, legacyPart))
  );
};

export const resolveTrainerScheduleCodes = (trainer) => {
  const codes = new Set();
  if (!trainer) return [];

  if (trainer.employeeId) codes.add(trainer.employeeId);

  (trainer.scheduleTrainerCodes || []).forEach((code) => {
    if (code) codes.add(String(code).trim());
  });

  const allLegacyMaps = [IDSA_TRAINER_NAMES, PSTP_TRAINER_NAMES];

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

export const findTrainerByScheduleCode = async (TrainerModel, scheduleCode) => {
  if (!scheduleCode) return null;

  const direct = await TrainerModel.findOne({
    $or: [{ employeeId: scheduleCode }, { scheduleTrainerCodes: scheduleCode }],
  });
  if (direct) return direct;

  const trainers = await TrainerModel.find();
  return trainers.find((trainer) =>
    resolveTrainerScheduleCodes(trainer).includes(scheduleCode)
  ) || null;
};
