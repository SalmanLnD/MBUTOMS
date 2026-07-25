import { IDSA_SUBJECT, PSTP_SUBJECT } from './trainerMappings.js';
import { LRRE_SUBJECT_CODE } from './lrreVSemesterTimetable.js';
import { QAVA_SUBJECT_CODE } from './subjectSlotTimings.js';

/**
 * Evaluators observe trainers for these subjects.
 * employeeId is stable; role is promoted to evaluator only when currently trainer.
 */
export const EVALUATOR_ASSIGNMENTS = [
  {
    employeeId: '135621',
    subjectCodes: [LRRE_SUBJECT_CODE, QAVA_SUBJECT_CODE],
    label: 'Naga Sai Kamesh',
  },
  {
    employeeId: '135130',
    subjectCodes: [LRRE_SUBJECT_CODE, QAVA_SUBJECT_CODE],
    label: 'Ravi Teja Naga Kumar',
  },
  {
    employeeId: '135269',
    subjectCodes: [IDSA_SUBJECT.code],
    label: 'Sharmila',
  },
  {
    employeeId: '135301',
    subjectCodes: [IDSA_SUBJECT.code],
    label: 'Navya',
  },
  {
    employeeId: '131886',
    subjectCodes: [PSTP_SUBJECT.code],
    label: 'Sai Priya',
  },
];

export const EVALUATOR_EMPLOYEE_IDS = EVALUATOR_ASSIGNMENTS.map(
  (assignment) => assignment.employeeId
);
