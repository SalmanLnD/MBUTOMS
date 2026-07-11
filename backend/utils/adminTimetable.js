import { ADMIN_TRAINER_EMPLOYEE_ID, DSAP_SUBJECT } from './trainerMappings.js';
import { SOLAS_THREE_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const ADMIN_SEMESTER = 'III';

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

/** MCA 1 timetable for admin (Muhammed Salman S F, employee 131665). */
export const ADMIN_MCA_WEEKLY_SLOTS = [
  { day: 'Monday', department: 'MCA', section: '1', ...dsap('S1') },
  { day: 'Tuesday', department: 'MCA', section: '1', ...dsap('S2') },
  { day: 'Friday', department: 'MCA', section: '1', ...dsap('S3') },
];

export const buildAdminMcaSchedulePayloads = () =>
  ADMIN_MCA_WEEKLY_SLOTS.map((entry) => ({
    trainerCode: ADMIN_TRAINER_EMPLOYEE_ID,
    semester: ADMIN_SEMESTER,
    day: entry.day,
    department: entry.department,
    section: entry.section,
    startTime: entry.startTime,
    endTime: entry.endTime,
    slot: entry.slot,
    subjectCode: entry.subjectCode,
  }));
