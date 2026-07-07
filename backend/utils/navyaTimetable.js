import { IDSA_SUBJECT } from './trainerMappings.js';
import { PSTJ_SUBJECT_CODE, SOC_FOUR_SLOT_TIMINGS, SOLAS_THREE_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const NAVYA_TRAINER_CODE = 'IDSA-T2';
export const NAVYA_SEMESTER = 'III';

const idsa = (slotKey) => {
  const field = slotKey.toLowerCase();
  const timing = SOC_FOUR_SLOT_TIMINGS[field];
  return {
    startTime: timing.startTime,
    endTime: timing.endTime,
    slot: slotKey,
    subjectCode: IDSA_SUBJECT.code,
  };
};

const pstj = (slotKey) => {
  const field = slotKey.toLowerCase();
  const timing = SOLAS_THREE_SLOT_TIMINGS[field];
  return {
    startTime: timing.startTime,
    endTime: timing.endTime,
    slot: slotKey,
    subjectCode: PSTJ_SUBJECT_CODE,
  };
};

/** Weekly III Semester timetable for Navya Mallidi (IDSA-T2). */
export const NAVYA_WEEKLY_SLOTS = [
  { day: 'Monday', department: 'AI&DS', section: 'AI&DS-2', ...idsa('S1') },
  { day: 'Monday', department: 'AI&DS', section: 'AI&DS-2', ...idsa('S2') },
  { day: 'Monday', department: 'B.COM(CA)', section: '1', ...pstj('S3') },

  { day: 'Tuesday', department: 'AI&DS', section: 'AI&DS-3', ...idsa('S1') },
  { day: 'Tuesday', department: 'AI&DS', section: 'AI&DS-2', ...idsa('S2') },
  { day: 'Tuesday', department: 'B.COM(CA)', section: '1', ...pstj('S3') },

  { day: 'Wednesday', department: 'AI&DS', section: 'AI&DS-2', ...idsa('S1') },

  { day: 'Thursday', department: 'AI&DS', section: 'AI&DS-3', ...idsa('S1') },
  { day: 'Thursday', department: 'AI&DS', section: 'AI&DS-3', ...idsa('S2') },
  { day: 'Thursday', department: 'B.COM(CA)', section: '1', ...pstj('S3') },

  { day: 'Friday', department: 'B.COM(CA)', section: '1', ...pstj('S1') },
  { day: 'Friday', department: 'AI&DS', section: 'AI&DS-3', ...idsa('S3') },
];

export const buildNavyaSchedulePayloads = () =>
  NAVYA_WEEKLY_SLOTS.map((entry) => ({
    trainerCode: NAVYA_TRAINER_CODE,
    semester: NAVYA_SEMESTER,
    day: entry.day,
    department: entry.department,
    section: entry.section,
    startTime: entry.startTime,
    endTime: entry.endTime,
    slot: entry.slot,
    subjectCode: entry.subjectCode,
  }));
