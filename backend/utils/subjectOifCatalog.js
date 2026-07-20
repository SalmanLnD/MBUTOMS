import { IDSA_SUBJECT, PSTP_SUBJECT, DSAP_SUBJECT } from './trainerMappings.js';
import { PSTJ_SUBJECT_CODE, QAVA_SUBJECT_CODE } from './subjectSlotTimings.js';
import { LRRE_SUBJECT_CODE } from './lrreVSemesterTimetable.js';

/**
 * Commercial OIF numbers for campus courses.
 * Attendance historically used short forms (IDSA, PSTP, …) or university codes;
 * both remap to these CT values.
 */
export const SUBJECT_OIF_CATALOG = [
  {
    code: IDSA_SUBJECT.code,
    name: 'Industrial Data Structures and Algorithms',
    oifNumber: 'CT27004',
    aliases: ['IDSA', 'PR/IDSA', IDSA_SUBJECT.code, '22CS102033'],
  },
  {
    code: PSTP_SUBJECT.code,
    name: 'Problem Solving Through Python',
    oifNumber: 'CT27005',
    aliases: ['PSTP', 'PR/PSTP', PSTP_SUBJECT.code, '22CS102034'],
  },
  {
    code: LRRE_SUBJECT_CODE,
    name: 'Logical Reasoning and Recruitment Essentials',
    oifNumber: 'CT27006',
    aliases: ['LRRE', 'PR/LRRE', LRRE_SUBJECT_CODE, '22LG101703'],
  },
  {
    code: PSTJ_SUBJECT_CODE,
    name: 'Problem Solving Through Java',
    oifNumber: 'CT27007',
    aliases: ['PSTJ', 'PR/PSTJ', PSTJ_SUBJECT_CODE, '22CA102006'],
  },
  {
    code: DSAP_SUBJECT.code,
    name: 'Data Structures and Algorithms Using Python',
    oifNumber: 'CT27008',
    aliases: ['DSAP', 'PR/DSAP', DSAP_SUBJECT.code, '25CA202009'],
  },
  {
    code: QAVA_SUBJECT_CODE,
    name: 'Quantitative Ability and Verbal Ability',
    oifNumber: 'CT27009',
    aliases: ['QAVA', 'PR/QAVA', QAVA_SUBJECT_CODE, '22LG101702'],
  },
];

export const getSubjectOifByCode = (subjectCode) => {
  const code = String(subjectCode || '').trim();
  return SUBJECT_OIF_CATALOG.find((entry) => entry.code === code) || null;
};

/** Map of uppercase alias → commercial OIF (for attendance remaps). */
export const buildAttendanceOifRemap = () => {
  const map = new Map();
  for (const entry of SUBJECT_OIF_CATALOG) {
    for (const alias of entry.aliases) {
      map.set(String(alias).trim().toUpperCase(), entry.oifNumber);
    }
    map.set(entry.oifNumber.toUpperCase(), entry.oifNumber);
  }
  return map;
};
