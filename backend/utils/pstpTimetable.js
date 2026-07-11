import { PSTP_SUBJECT } from './trainerMappings.js';
import { SOC_FOUR_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const PSTP_SEMESTER = 'III';

const pstp = (slotKey) => {
  const timing = SOC_FOUR_SLOT_TIMINGS[slotKey.toLowerCase()];
  return {
    slot: slotKey,
    startTime: timing.startTime,
    endTime: timing.endTime,
    subjectCode: PSTP_SUBJECT.code,
  };
};

const cls = (department, section) => ({ department, section });

/** PSTP T9 — Mahendra Urumu (III Semester, SOC 4-period grid). */
export const PSTP_T9_WEEKLY_SLOTS = [
  { day: 'Monday', ...cls('CE & ME', 'CE-ME 1'), ...pstp('S1') },
  { day: 'Monday', ...cls('EEE', 'EEE1'), ...pstp('S3') },
  { day: 'Monday', ...cls('CE & ME', 'CE-ME 1'), ...pstp('S4') },
  { day: 'Tuesday', ...cls('EEE', 'EEE2'), ...pstp('S1') },
  { day: 'Tuesday', ...cls('EEE', 'EEE2'), ...pstp('S2') },
  { day: 'Tuesday', ...cls('ECE & EIE', 'EIE'), ...pstp('S3') },
  { day: 'Tuesday', ...cls('EEE', 'EEE1'), ...pstp('S4') },
  { day: 'Wednesday', ...cls('EEE', 'EEE1'), ...pstp('S1') },
  { day: 'Wednesday', ...cls('CE & ME', 'CE-ME 1'), ...pstp('S2') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'EIE'), ...pstp('S3') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'EIE'), ...pstp('S4') },
  { day: 'Thursday', ...cls('EEE', 'EEE2'), ...pstp('S1') },
  { day: 'Thursday', ...cls('EEE', 'EEE1'), ...pstp('S2') },
  { day: 'Thursday', ...cls('CE & ME', 'CE-ME 1'), ...pstp('S3') },
  { day: 'Friday', ...cls('EEE', 'EEE2'), ...pstp('S3') },
  { day: 'Friday', ...cls('ECE & EIE', 'EIE'), ...pstp('S4') },
];

export const PSTP_T9_TRAINER_CODE = 'PSTP-T9';

export const buildPstpT9SchedulePayloads = () =>
  PSTP_T9_WEEKLY_SLOTS.map((entry) => ({
    trainerCode: PSTP_T9_TRAINER_CODE,
    semester: PSTP_SEMESTER,
    day: entry.day,
    department: entry.department,
    section: entry.section,
    startTime: entry.startTime,
    endTime: entry.endTime,
    slot: entry.slot,
    subjectCode: entry.subjectCode,
  }));

export const buildPstpSchedulePayloads = () => buildPstpT9SchedulePayloads();
