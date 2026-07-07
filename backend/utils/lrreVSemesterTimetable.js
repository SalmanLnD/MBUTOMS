export const LRRE_SUBJECT_CODE = '22LG101703';
export const LRRE_V_SEMESTER = 'V';

export const LRRE_V_SLOT_TIMINGS = {
  S1: { startTime: '09:00', endTime: '10:50', slot: 'S1' },
  S2: { startTime: '11:10', endTime: '13:00', slot: 'S2' },
  S3: { startTime: '14:45', endTime: '16:45', slot: 'S3' },
};

/** employeeId -> weekly LRRE V Semester allocation (source of truth for sync + tests) */
export const LRRE_V_TRAINER_ALLOCATIONS = {
  '135130': {
    name: 'Ravi Teja Naga Kumar V',
    slots: [
      { day: 'Monday', slot: 'S1', class: 'CSE A1' },
      { day: 'Monday', slot: 'S3', class: 'CSE A2' },
      { day: 'Tuesday', slot: 'S1', class: 'CSE A5' },
      { day: 'Tuesday', slot: 'S2', class: 'CSE A3' },
      { day: 'Tuesday', slot: 'S3', class: 'CSE A6' },
      { day: 'Wednesday', slot: 'S1', class: 'CSE A3' },
      { day: 'Wednesday', slot: 'S2', class: 'CSE A1' },
      { day: 'Wednesday', slot: 'S3', class: 'CSE A5' },
      { day: 'Thursday', slot: 'S1', class: 'CSE A2' },
      { day: 'Thursday', slot: 'S2', class: 'CSE A4' },
      { day: 'Friday', slot: 'S1', class: 'CSE A6' },
      { day: 'Friday', slot: 'S2', class: 'CSE A4' },
    ],
  },
  '135621': {
    name: 'Naga Sai Kamesh T',
    slots: [
      { day: 'Monday', slot: 'S1', class: 'CSE A9' },
      { day: 'Monday', slot: 'S2', class: 'CSE A7' },
      { day: 'Monday', slot: 'S3', class: 'AIML B1' },
      { day: 'Tuesday', slot: 'S1', class: 'CSE A10' },
      { day: 'Tuesday', slot: 'S2', class: 'CSE A8' },
      { day: 'Tuesday', slot: 'S3', class: 'AIML B1' },
      { day: 'Wednesday', slot: 'S2', class: 'CSE A7' },
      { day: 'Wednesday', slot: 'S3', class: 'CSE A9' },
      { day: 'Thursday', slot: 'S1', class: 'CSE A10' },
      { day: 'Thursday', slot: 'S2', class: 'AIML B2' },
      { day: 'Friday', slot: 'S1', class: 'CSE A8' },
      { day: 'Friday', slot: 'S2', class: 'AIML B2' },
    ],
  },
  '135402': {
    name: 'Barath M',
    slots: [
      { day: 'Monday', slot: 'S1', class: 'AIML B3' },
      { day: 'Monday', slot: 'S3', class: 'AIML B6' },
      { day: 'Tuesday', slot: 'S1', class: 'AIML B6' },
      { day: 'Tuesday', slot: 'S3', class: 'AIML B4' },
      { day: 'Wednesday', slot: 'S1', class: 'AIML B3' },
      { day: 'Wednesday', slot: 'S2', class: 'AIML B8' },
      { day: 'Wednesday', slot: 'S3', class: 'AIML B5' },
      { day: 'Thursday', slot: 'S1', class: 'AIML B7' },
      { day: 'Thursday', slot: 'S2', class: 'AIML B4' },
      { day: 'Friday', slot: 'S1', class: 'AIML B7' },
      { day: 'Friday', slot: 'S2', class: 'AIML B5' },
      { day: 'Friday', slot: 'S3', class: 'AIML B8' },
    ],
  },
  '135517': {
    name: 'Thanneru Laxmi Priya',
    slots: [
      { day: 'Monday', slot: 'S1', class: 'AIML B9' },
      { day: 'Monday', slot: 'S2', class: 'AIML B12' },
      { day: 'Tuesday', slot: 'S1', class: 'DS DS1' },
      { day: 'Tuesday', slot: 'S2', class: 'AIML B9' },
      { day: 'Wednesday', slot: 'S1', class: 'AIML B10' },
      { day: 'Wednesday', slot: 'S2', class: 'AIML B11' },
      { day: 'Wednesday', slot: 'S3', class: 'DS DS1' },
      { day: 'Thursday', slot: 'S1', class: 'AIML B10' },
      { day: 'Thursday', slot: 'S3', class: 'AIML B11' },
      { day: 'Friday', slot: 'S1', class: 'DS DS2' },
      { day: 'Friday', slot: 'S2', class: 'AIML B12' },
    ],
  },
  '136047': {
    name: 'Akuthota Praharsha',
    slots: [
      { day: 'Monday', slot: 'S2', class: 'CS CS1' },
      { day: 'Tuesday', slot: 'S2', class: 'DS DS3' },
      { day: 'Tuesday', slot: 'S3', class: 'CS IT' },
      { day: 'Wednesday', slot: 'S1', class: 'CS CS1' },
      { day: 'Wednesday', slot: 'S2', class: 'DS DS3' },
      { day: 'Thursday', slot: 'S2', class: 'CS CS2' },
      { day: 'Friday', slot: 'S1', class: 'CS IT' },
      { day: 'Friday', slot: 'S3', class: 'CS CS2' },
    ],
  },
  '801406': {
    name: 'Harinisree',
    slots: [],
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

export const buildExpectedScheduleRecord = (employeeId, entry, subjectId) => {
  const timing = LRRE_V_SLOT_TIMINGS[entry.slot];
  const { department, section } = parseLrreClassLabel(entry.class);

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
