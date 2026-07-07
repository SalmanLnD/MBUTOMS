export const SOC_FOUR_SLOT_TIMINGS = {
  s1: { startTime: '09:00', endTime: '10:00' },
  s2: { startTime: '10:30', endTime: '12:30' },
  s3: { startTime: '13:45', endTime: '15:45' },
  s4: { startTime: '15:45', endTime: '16:45' },
};

export const SOLAS_THREE_SLOT_TIMINGS = {
  s1: { startTime: '09:00', endTime: '11:00' },
  s2: { startTime: '11:30', endTime: '13:30' },
  s3: { startTime: '14:45', endTime: '16:45' },
  s4: { startTime: '14:45', endTime: '16:45' },
};

export const LRRE_THREE_SLOT_TIMINGS = {
  s1: { startTime: '09:00', endTime: '10:50' },
  s2: { startTime: '11:10', endTime: '13:00' },
  s3: { startTime: '14:45', endTime: '16:45' },
  s4: { startTime: '14:45', endTime: '16:45' },
};

export const PEDH_SUBJECT_CODE = '22CS102037';
export const IDSA_SUBJECT_CODE = '22CS102033';
export const PSTP_SUBJECT_CODE = '22CS102034';
export const DSAP_SUBJECT_CODE = '25CA202009';
export const PSTJ_SUBJECT_CODE = '22CA102006';
export const LRRE_SUBJECT_CODE = '22LG101703';

export const SUBJECT_SLOT_PROFILES = {
  [PEDH_SUBJECT_CODE]: { timings: SOC_FOUR_SLOT_TIMINGS, slotCount: 4 },
  [IDSA_SUBJECT_CODE]: { timings: SOC_FOUR_SLOT_TIMINGS, slotCount: 4 },
  [PSTP_SUBJECT_CODE]: { timings: SOC_FOUR_SLOT_TIMINGS, slotCount: 4 },
  [DSAP_SUBJECT_CODE]: { timings: SOLAS_THREE_SLOT_TIMINGS, slotCount: 3 },
  [PSTJ_SUBJECT_CODE]: { timings: SOLAS_THREE_SLOT_TIMINGS, slotCount: 3 },
  [LRRE_SUBJECT_CODE]: { timings: LRRE_THREE_SLOT_TIMINGS, slotCount: 3 },
};

export const getSubjectSlotProfile = (subjectCode) =>
  SUBJECT_SLOT_PROFILES[String(subjectCode || '').trim()] || null;

export const getSubjectSlotCount = (subject) => {
  if (subject?.slotCount) return subject.slotCount;
  const profile = getSubjectSlotProfile(subject?.code);
  return profile?.slotCount || 4;
};
