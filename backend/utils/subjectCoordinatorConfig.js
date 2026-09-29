import { IDSA_SUBJECT, PSTP_SUBJECT } from './trainerMappings.js';
import { LRRE_SUBJECT_CODE } from './lrreVSemesterTimetable.js';
import { QAVA_SUBJECT_CODE } from './subjectSlotTimings.js';

/** employeeId -> subject code for subject coordinator assignments. */
export const SUBJECT_COORDINATOR_ASSIGNMENTS = [
  { employeeId: '135130', subjectCode: LRRE_SUBJECT_CODE, label: 'LRRE' },
  { employeeId: '135130', subjectCode: QAVA_SUBJECT_CODE, label: 'QAVA' },
  { employeeId: '131886', subjectCode: PSTP_SUBJECT.code, label: 'PSTP' },
  { employeeId: '135301', subjectCode: IDSA_SUBJECT.code, label: 'IDSA' },
];
