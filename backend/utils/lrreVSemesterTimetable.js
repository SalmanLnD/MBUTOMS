export const LRRE_SUBJECT_CODE = '22LG101703';
export const LRRE_V_SEMESTER = 'V';

export const LRRE_V_SLOT_TIMINGS = {
  S1: { startTime: '09:00', endTime: '10:50', slot: 'S1' },
  S2: { startTime: '11:10', endTime: '13:00', slot: 'S2' },
  S3: { startTime: '14:45', endTime: '16:45', slot: 'S3' },
};

const slot = (day, key, department, section) => ({ day, slot: key, department, section });

/** employeeId -> weekly LRRE V Semester allocation (source of truth for sync + tests) */
export const LRRE_V_TRAINER_ALLOCATIONS = {
  '135130': {
    name: 'Ravi Teja Naga Kumar V',
    slots: [
      slot('Monday', 'S1', 'CSE', 'A1'),
      slot('Monday', 'S3', 'CSE', 'A2'),
      slot('Tuesday', 'S1', 'CSE', 'A5'),
      slot('Tuesday', 'S2', 'CSE', 'A3'),
      slot('Tuesday', 'S3', 'CSE', 'A6'),
      slot('Wednesday', 'S1', 'CSE', 'A3'),
      slot('Wednesday', 'S2', 'CSE', 'A1'),
      slot('Wednesday', 'S3', 'CSE', 'A5'),
      slot('Thursday', 'S1', 'CSE', 'A2'),
      slot('Thursday', 'S2', 'CSE', 'A4'),
      slot('Friday', 'S1', 'CSE', 'A6'),
      slot('Friday', 'S2', 'CSE', 'A4'),
    ],
  },
  '135621': {
    name: 'Naga Sai Kamesh T',
    slots: [
      slot('Monday', 'S1', 'CSE', 'A9'),
      slot('Monday', 'S2', 'CSE', 'A7'),
      slot('Monday', 'S3', 'AIML', 'B1'),
      slot('Tuesday', 'S1', 'CSE', 'A10'),
      slot('Tuesday', 'S2', 'CSE', 'A8'),
      slot('Tuesday', 'S3', 'AIML', 'B1'),
      slot('Wednesday', 'S2', 'CSE', 'A7'),
      slot('Wednesday', 'S3', 'CSE', 'A9'),
      slot('Thursday', 'S1', 'CSE', 'A10'),
      slot('Thursday', 'S2', 'AIML', 'B2'),
      slot('Friday', 'S1', 'CSE', 'A8'),
      slot('Friday', 'S2', 'AIML', 'B2'),
    ],
  },
  '136047': {
    name: 'Akuthota Praharsha',
    slots: [
      slot('Monday', 'S1', 'AIML', 'B3'),
      slot('Monday', 'S3', 'AIML', 'B6'),
      slot('Tuesday', 'S1', 'AIML', 'B6'),
      slot('Tuesday', 'S3', 'AIML', 'B4'),
      slot('Wednesday', 'S1', 'AIML', 'B3'),
      slot('Wednesday', 'S2', 'AIML', 'B8'),
      slot('Wednesday', 'S3', 'AIML', 'B5'),
      slot('Thursday', 'S1', 'AIML', 'B7'),
      slot('Thursday', 'S2', 'AIML', 'B4'),
      slot('Friday', 'S1', 'AIML', 'B7'),
      slot('Friday', 'S2', 'AIML', 'B5'),
      slot('Friday', 'S3', 'AIML', 'B8'),
    ],
  },
  '135517': {
    name: 'Thanneru Laxmi Priya',
    slots: [
      slot('Monday', 'S1', 'AIML', 'B9'),
      slot('Monday', 'S2', 'AIML', 'B12'),
      slot('Monday', 'S3', 'DS', 'DS2'),
      slot('Tuesday', 'S1', 'DS', 'DS1'),
      slot('Tuesday', 'S2', 'AIML', 'B9'),
      slot('Wednesday', 'S1', 'AIML', 'B10'),
      slot('Wednesday', 'S2', 'AIML', 'B11'),
      slot('Wednesday', 'S3', 'DS', 'DS1'),
      slot('Thursday', 'S1', 'AIML', 'B10'),
      slot('Thursday', 'S3', 'AIML', 'B11'),
      slot('Friday', 'S1', 'DS', 'DS2'),
      slot('Friday', 'S2', 'AIML', 'B12'),
    ],
  },
  '801406': {
    name: 'Harinisree',
    slots: [
      slot('Monday', 'S2', 'CS', 'CS1'),
      slot('Monday', 'S3', 'ECE & EIE', 'ECE1'),
      slot('Tuesday', 'S1', 'ECE & EIE', 'ECE1'),
      slot('Tuesday', 'S2', 'DS', 'DS3'),
      slot('Tuesday', 'S3', 'IT', 'IT'),
      slot('Wednesday', 'S1', 'CS', 'CS1'),
      slot('Wednesday', 'S2', 'DS', 'DS3'),
      slot('Thursday', 'S2', 'CS', 'CS2'),
      slot('Thursday', 'S3', 'ECE & EIE', 'ECE3'),
      slot('Friday', 'S1', 'IT', 'IT'),
      slot('Friday', 'S3', 'CS', 'CS2'),
    ],
  },
  '135402': {
    name: 'Barath M',
    slots: [
      slot('Monday', 'S1', 'ECE & EIE', 'ECE3'),
      slot('Monday', 'S2', 'CE & ME', 'CE-ME 1'),
      slot('Monday', 'S3', 'ECE & EIE', 'ECE4'),
      slot('Tuesday', 'S1', 'ECE & EIE', 'ECE3'),
      slot('Tuesday', 'S2', 'ECE & EIE', 'EIE'),
      slot('Wednesday', 'S1', 'EEE', 'EEE1'),
      slot('Wednesday', 'S3', 'EEE', 'EEE2'),
      slot('Thursday', 'S1', 'EEE', 'EEE2'),
      slot('Thursday', 'S2', 'ECE & EIE', 'EIE'),
      slot('Thursday', 'S3', 'ECE & EIE', 'ECE4'),
      slot('Friday', 'S1', 'EEE', 'EEE1'),
      slot('Friday', 'S2', 'CE & ME', 'CE-ME 1'),
    ],
  },
};

export const LRRE_V_TRAINER_EMPLOYEE_IDS = Object.keys(LRRE_V_TRAINER_ALLOCATIONS);

export const parseLrreClassLabel = (label) => {
  const trimmed = label.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex <= 0) {
    throw new Error(`Invalid class label: ${label}`);
  }
  return {
    department: trimmed.slice(0, spaceIndex),
    section: trimmed.slice(spaceIndex + 1),
  };
};

export const resolveLrreClass = (entry) => {
  if (entry.department && entry.section) {
    return { department: entry.department, section: entry.section };
  }
  if (entry.class) {
    return parseLrreClassLabel(entry.class);
  }
  throw new Error(`LRRE slot missing class mapping for ${entry.day} ${entry.slot}`);
};

export const buildExpectedScheduleRecord = (employeeId, entry, subjectId) => {
  const timing = LRRE_V_SLOT_TIMINGS[entry.slot];
  const { department, section } = resolveLrreClass(entry);

  return {
    trainerCode: employeeId,
    day: entry.day,
    startTime: timing.startTime,
    endTime: timing.endTime,
    department,
    section,
    subjectCode: LRRE_SUBJECT_CODE,
    subject: subjectId,
    slot: timing.slot,
    semester: LRRE_V_SEMESTER,
  };
};

export const formatScheduleWebLabel = (schedule) =>
  `${schedule.department} ${schedule.section}`.trim();

export const scheduleKey = (schedule) =>
  [
    schedule.trainerCode,
    schedule.day,
    schedule.slot || schedule.startTime,
    schedule.department,
    schedule.section,
  ].join('|');
