import { SOLAS_THREE_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const QAVA_SUBJECT_CODE = '22LG101702';
export const QAVA_TRAINER_EMPLOYEE_ID = '135887';
export const QAVA_SEMESTER = 'III';

const qavaSlot = (slotKey) => {
  const timing = SOLAS_THREE_SLOT_TIMINGS[slotKey.toLowerCase()];
  return {
    slot: slotKey,
    startTime: timing.startTime,
    endTime: timing.endTime,
    subjectCode: QAVA_SUBJECT_CODE,
  };
};

/** Weekly III Semester timetable for Suryadeo Kumar Rana (QAVA). */
export const QAVA_WEEKLY_SLOTS = [
  { day: 'Tuesday', department: 'BCA', section: 'BCA3 & BSC(CS)', ...qavaSlot('S1') },
  { day: 'Tuesday', department: 'BCA', section: 'BCA2', ...qavaSlot('S3') },
  { day: 'Wednesday', department: 'BCA', section: 'BCA1', ...qavaSlot('S2') },
  { day: 'Thursday', department: 'BCA', section: 'BCA3 & BSC(CS)', ...qavaSlot('S3') },
  { day: 'Friday', department: 'BCA', section: 'BCA2', ...qavaSlot('S1') },
  { day: 'Friday', department: 'BCA', section: 'BCA1', ...qavaSlot('S3') },
];

export const buildQavaSchedulePayloads = () =>
  QAVA_WEEKLY_SLOTS.map((entry) => ({
    trainerCode: QAVA_TRAINER_EMPLOYEE_ID,
    semester: QAVA_SEMESTER,
    day: entry.day,
    department: entry.department,
    section: entry.section,
    startTime: entry.startTime,
    endTime: entry.endTime,
    slot: entry.slot,
    subjectCode: entry.subjectCode,
  }));
