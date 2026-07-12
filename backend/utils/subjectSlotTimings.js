import { IDSA_SUBJECT, PSTP_SUBJECT, DSAP_SUBJECT } from './trainerMappings.js';
import { LRRE_SUBJECT_CODE } from './lrreVSemesterTimetable.js';

/** IDSA, PSTP — SOC 4 periods */
export const SOC_FOUR_SLOT_TIMINGS = {
  s1: { startTime: '09:00', endTime: '10:00' },
  s2: { startTime: '10:30', endTime: '12:30' },
  s3: { startTime: '13:45', endTime: '15:45' },
  s4: { startTime: '15:45', endTime: '16:45' },
};

/** QAVA, DSAP, PSTJ — SOLAS 3 periods */
export const SOLAS_THREE_SLOT_TIMINGS = {
  s1: { startTime: '09:00', endTime: '11:00' },
  s2: { startTime: '11:30', endTime: '13:30' },
  s3: { startTime: '14:45', endTime: '16:45' },
  s4: { startTime: '14:45', endTime: '16:45' },
};

/** QAVA — same as SOLAS: 09:00–11:00, 11:30–13:30, 14:45–16:45 */
export const QAVA_THREE_SLOT_TIMINGS = SOLAS_THREE_SLOT_TIMINGS;

/** LRRE — 3 periods */
export const LRRE_THREE_SLOT_TIMINGS = {
  s1: { startTime: '09:00', endTime: '10:50' },
  s2: { startTime: '11:10', endTime: '13:00' },
  s3: { startTime: '14:45', endTime: '16:45' },
  s4: { startTime: '14:45', endTime: '16:45' },
};

export const PSTJ_SUBJECT_CODE = '22CA102006';
export const QAVA_SUBJECT_CODE = '22LG101702';

export const SUBJECT_SLOT_PROFILES = {
  [IDSA_SUBJECT.code]: { timings: SOC_FOUR_SLOT_TIMINGS, slotCount: 4 },
  [PSTP_SUBJECT.code]: { timings: SOC_FOUR_SLOT_TIMINGS, slotCount: 4 },
  [DSAP_SUBJECT.code]: { timings: SOLAS_THREE_SLOT_TIMINGS, slotCount: 3 },
  [PSTJ_SUBJECT_CODE]: { timings: SOLAS_THREE_SLOT_TIMINGS, slotCount: 3 },
  [QAVA_SUBJECT_CODE]: { timings: QAVA_THREE_SLOT_TIMINGS, slotCount: 3 },
  [LRRE_SUBJECT_CODE]: { timings: LRRE_THREE_SLOT_TIMINGS, slotCount: 3 },
};

export const getSubjectSlotProfile = (subjectCode) =>
  SUBJECT_SLOT_PROFILES[String(subjectCode || '').trim()] || null;

export const getSubjectSlotCount = (subject) => {
  const profile = getSubjectSlotProfile(subject?.code);
  if (profile?.slotCount) return profile.slotCount;
  if (subject?.slotCount) return subject.slotCount;
  return 4;
};
