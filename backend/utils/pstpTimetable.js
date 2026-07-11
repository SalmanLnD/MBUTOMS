import { PSTP_SUBJECT } from './trainerMappings.js';
import { SOC_FOUR_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const PSTP_SEMESTER = 'III';
export const PSTP_T8_TRAINER_CODE = 'PSTP-T8';
export const PSTP_T9_TRAINER_CODE = 'PSTP-T9';

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

/** PSTP T15 — Ashwini M (system code PSTP-T8). */
export const PSTP_T8_WEEKLY_SLOTS = [
  { day: 'Monday', ...cls('ECE & EIE', 'ECE3'), ...pstp('S1') },
  { day: 'Monday', ...cls('ECE & EIE', 'ECE2'), ...pstp('S2') },
  { day: 'Monday', ...cls('ECE & EIE', 'ECE3'), ...pstp('S3') },
  { day: 'Tuesday', ...cls('ECE & EIE', 'ECE2'), ...pstp('S1') },
  { day: 'Tuesday', ...cls('ECE & EIE', 'ECE4'), ...pstp('S3') },
  { day: 'Tuesday', ...cls('ECE & EIE', 'ECE2'), ...pstp('S4') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'ECE4'), ...pstp('S1') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'ECE2'), ...pstp('S2') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'ECE1'), ...pstp('S3') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'ECE1'), ...pstp('S4') },
  { day: 'Thursday', ...cls('ECE & EIE', 'ECE3'), ...pstp('S1') },
  { day: 'Thursday', ...cls('ECE & EIE', 'ECE4'), ...pstp('S2') },
  { day: 'Thursday', ...cls('ECE & EIE', 'ECE3'), ...pstp('S3') },
  { day: 'Thursday', ...cls('ECE & EIE', 'ECE4'), ...pstp('S4') },
  { day: 'Friday', ...cls('ECE & EIE', 'ECE1'), ...pstp('S3') },
  { day: 'Friday', ...cls('ECE & EIE', 'ECE1'), ...pstp('S4') },
];

/** PSTP T16 — Mahendra Urumu (system code PSTP-T9). */
export const PSTP_T9_WEEKLY_SLOTS = [
  { day: 'Monday', ...cls('CE & ME', 'CE-ME'), ...pstp('S1') },
  { day: 'Monday', ...cls('EEE', 'EEE1'), ...pstp('S3') },
  { day: 'Monday', ...cls('CE & ME', 'CE-ME'), ...pstp('S4') },
  { day: 'Tuesday', ...cls('EEE', 'EEE2'), ...pstp('S1') },
  { day: 'Tuesday', ...cls('EEE', 'EEE2'), ...pstp('S2') },
  { day: 'Tuesday', ...cls('ECE & EIE', 'EIE'), ...pstp('S3') },
  { day: 'Tuesday', ...cls('EEE', 'EEE1'), ...pstp('S4') },
  { day: 'Wednesday', ...cls('EEE', 'EEE1'), ...pstp('S1') },
  { day: 'Wednesday', ...cls('CE & ME', 'CE-ME'), ...pstp('S2') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'EIE'), ...pstp('S3') },
  { day: 'Wednesday', ...cls('ECE & EIE', 'EIE'), ...pstp('S4') },
  { day: 'Thursday', ...cls('EEE', 'EEE2'), ...pstp('S1') },
  { day: 'Thursday', ...cls('EEE', 'EEE1'), ...pstp('S2') },
  { day: 'Thursday', ...cls('CE & ME', 'CE-ME'), ...pstp('S3') },
  { day: 'Friday', ...cls('EEE', 'EEE2'), ...pstp('S3') },
  { day: 'Friday', ...cls('ECE & EIE', 'EIE'), ...pstp('S4') },
];

const buildPayloads = (trainerCode, slots) =>
  slots.map((entry) => ({
    trainerCode,
    semester: PSTP_SEMESTER,
    day: entry.day,
    department: entry.department,
    section: entry.section,
    startTime: entry.startTime,
    endTime: entry.endTime,
    slot: entry.slot,
    subjectCode: entry.subjectCode,
  }));

export const buildPstpT8SchedulePayloads = () =>
  buildPayloads(PSTP_T8_TRAINER_CODE, PSTP_T8_WEEKLY_SLOTS);

export const buildPstpT9SchedulePayloads = () =>
  buildPayloads(PSTP_T9_TRAINER_CODE, PSTP_T9_WEEKLY_SLOTS);

export const buildPstpSchedulePayloads = () => [
  ...buildPstpT8SchedulePayloads(),
  ...buildPstpT9SchedulePayloads(),
];
