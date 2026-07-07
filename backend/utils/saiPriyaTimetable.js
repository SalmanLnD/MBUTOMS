import { SAI_PRIYA_TRAINER_CODE, PEDH_SUBJECT, DSAP_SUBJECT } from './trainerMappings.js';
import { SOC_FOUR_SLOT_TIMINGS, SOLAS_THREE_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const SAI_PRIYA_SEMESTER = 'III';

const pedh = (slotKey) => {
  const field = slotKey.toLowerCase();
  const timing = SOC_FOUR_SLOT_TIMINGS[field];
  return {
    startTime: timing.startTime,
    endTime: timing.endTime,
    slot: slotKey,
    subjectCode: PEDH_SUBJECT.code,
  };
};

const dsap = (slotKey) => {
  const field = slotKey.toLowerCase();
  const timing = SOLAS_THREE_SLOT_TIMINGS[field];
  return {
    startTime: timing.startTime,
    endTime: timing.endTime,
    slot: slotKey,
    subjectCode: DSAP_SUBJECT.code,
  };
};

/** Weekly III Semester timetable for M Sai Priya (PEDH- T07). */
export const SAI_PRIYA_WEEKLY_SLOTS = [
  { day: 'Monday', department: 'MCA', section: '1', ...dsap('S1') },
  { day: 'Monday', department: 'AI&DS', section: 'AI&DS-3', ...pedh('S3') },
  { day: 'Monday', department: 'AI&DS', section: 'AI&DS-3', ...pedh('S4') },

  { day: 'Tuesday', department: 'AI&DS', section: 'AI&DS-2', ...pedh('S1') },
  { day: 'Tuesday', department: 'MCA', section: '1', ...dsap('S2') },

  { day: 'Wednesday', department: 'AI&DS', section: 'AI&DS-3', ...pedh('S1') },
  { day: 'Wednesday', department: 'AI&DS', section: 'AI&DS-3', ...pedh('S2') },
  { day: 'Wednesday', department: 'AI&DS', section: 'AI&DS-2', ...pedh('S3') },

  { day: 'Thursday', department: 'AI&DS', section: 'AI&DS-2', ...pedh('S2') },
  { day: 'Thursday', department: 'AI&DS', section: 'AI&DS-2', ...pedh('S4') },

  { day: 'Friday', department: 'MCA', section: '1', ...dsap('S3') },
];

export const buildSaiPriyaSchedulePayloads = () =>
  SAI_PRIYA_WEEKLY_SLOTS.map((entry) => ({
    trainerCode: SAI_PRIYA_TRAINER_CODE,
    semester: SAI_PRIYA_SEMESTER,
    day: entry.day,
    department: entry.department,
    section: entry.section,
    startTime: entry.startTime,
    endTime: entry.endTime,
    slot: entry.slot,
    subjectCode: entry.subjectCode,
  }));
