import { IDSA_SUBJECT, PEDH_SUBJECT } from './trainerMappings.js';
import { SOC_FOUR_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const III_SEMESTER = 'III';

const toSlot = (slotKey, subjectCode) => {
  const timing = SOC_FOUR_SLOT_TIMINGS[slotKey.toLowerCase()];
  return {
    slot: slotKey,
    startTime: timing.startTime,
    endTime: timing.endTime,
    subjectCode,
  };
};

const idsa = (slotKey) => toSlot(slotKey, IDSA_SUBJECT.code);
const pedh = (slotKey) => toSlot(slotKey, PEDH_SUBJECT.code);

const cls = (department, section) => ({ department, section });

const CSE_A1 = cls('CSE', 'A1');
const CSE_A2 = cls('CSE', 'A2');
const CSE_A3 = cls('CSE', 'A3');
const CSE_A4 = cls('CSE', 'A4');
const CSE_A5 = cls('CSE', 'A5');
const CSE_A6_DEVOPS = cls('CSE', 'A6-Devops');
const CSE_A7_CC = cls('CSE', "A7'-CC");
const AIML_B1 = cls('AIML', 'B1');
const AIML_B2 = cls('AIML', 'B2');
const AIML_B3 = cls('AIML', 'B3');
const AIML_B4 = cls('AIML', 'B4');
const AIML_B5 = cls('AIML', 'B5');
const AIML_B6 = cls('AIML', 'B6');
const AIML_B7 = cls('AIML', 'B7');
const AIML_B8 = cls('AIML', 'B8');
const AIML_B9 = cls('AIML', 'B9');
const AIML_B10 = cls('AIML', 'B10');
const AIML_B11 = cls('AIML', 'B11');
const AI_DS_1 = cls('AI&DS', 'AI&DS-1');
const CS_CS1 = cls('CS', 'CS1');
const CS_CS2 = cls('CS', 'CS2');
const IT_IT = cls('IT', 'IT');
const DS_1 = cls('DS', 'DS1');
const DS_2_ECM = cls('DS', 'DS2 + ECM');

const entry = (trainerCode, day, slotKey, classInfo, subjectKind) => ({
  trainerCode,
  day,
  ...classInfo,
  ...(subjectKind === 'PEDH' ? pedh(slotKey) : idsa(slotKey)),
});

const expandTrainer = ({ trainerCode, subjectKind, rows }) =>
  rows.flatMap(([day, slots]) =>
    slots.flatMap((classInfo, index) =>
      classInfo ? [entry(trainerCode, day, `S${index + 1}`, classInfo, subjectKind)] : []
    )
  );

export const TRAINER_TIMETABLE_DEFINITIONS = [
  {
    trainerCode: 'IDSA-T1',
    subjectKind: 'IDSA',
    rows: [
      ['Monday', [CSE_A1, CSE_A1, CSE_A3, null]],
      ['Tuesday', [CSE_A1, CSE_A4, CSE_A2, CSE_A3]],
      ['Wednesday', [CSE_A3, CSE_A1, CSE_A4, CSE_A2]],
      ['Thursday', [CSE_A4, CSE_A3, CSE_A2, null]],
      ['Friday', [CSE_A4, null, null, CSE_A2]],
    ],
  },
  {
    trainerCode: 'PEDH- T04',
    subjectKind: 'PEDH',
    rows: [
      ['Monday', [AIML_B1, CSE_A6_DEVOPS, CSE_A5, CSE_A5]],
      ['Tuesday', [null, CSE_A7_CC, AIML_B1, null]],
      ['Wednesday', [CSE_A6_DEVOPS, null, AIML_B1, CSE_A7_CC]],
      ['Thursday', [CSE_A5, null, CSE_A6_DEVOPS, CSE_A7_CC]],
      ['Friday', [CSE_A6_DEVOPS, CSE_A7_CC, CSE_A5, AIML_B1]],
    ],
  },
  {
    trainerCode: 'IDSA-T5',
    subjectKind: 'IDSA',
    rows: [
      ['Monday', [CSE_A6_DEVOPS, AIML_B1, null, null]],
      ['Tuesday', [CSE_A5, null, CSE_A6_DEVOPS, CSE_A7_CC]],
      ['Wednesday', [AIML_B1, CSE_A7_CC, CSE_A5, CSE_A6_DEVOPS]],
      ['Thursday', [CSE_A7_CC, CSE_A5, AIML_B1, AIML_B1]],
      ['Friday', [CSE_A5, CSE_A6_DEVOPS, CSE_A7_CC, null]],
    ],
  },
  {
    trainerCode: 'IDSA-T7',
    subjectKind: 'IDSA',
    rows: [
      ['Monday', [null, AIML_B2, AIML_B5, AIML_B5]],
      ['Tuesday', [AIML_B3, AIML_B3, AIML_B4, null]],
      ['Wednesday', [AIML_B5, null, AIML_B2, AIML_B2]],
      ['Thursday', [AIML_B2, AIML_B4, null, AIML_B4]],
      ['Friday', [AIML_B4, AIML_B5, AIML_B3, AIML_B3]],
    ],
  },
  {
    trainerCode: 'PEDH- T05',
    subjectKind: 'PEDH',
    rows: [
      ['Monday', [AIML_B3, AIML_B4, AIML_B3, AIML_B2]],
      ['Tuesday', [AIML_B5, AIML_B2, AIML_B5, AIML_B4]],
      ['Wednesday', [AIML_B4, AIML_B3, AIML_B4, AIML_B5]],
      ['Thursday', [null, AIML_B2, null, AIML_B2]],
      ['Friday', [AIML_B3, null, AIML_B5, null]],
    ],
  },
  {
    trainerCode: 'IDSA-T6',
    subjectKind: 'IDSA',
    rows: [
      ['Monday', [AIML_B6, AIML_B9, AIML_B6, null]],
      ['Tuesday', [AIML_B9, null, AIML_B8, null]],
      ['Wednesday', [AIML_B8, AIML_B7, AIML_B8, AIML_B9]],
      ['Thursday', [AIML_B6, AIML_B6, null, AIML_B7]],
      ['Friday', [AIML_B7, AIML_B9, AIML_B7, AIML_B8]],
    ],
  },
  {
    trainerCode: 'PEDH- T01',
    subjectKind: 'PEDH',
    rows: [
      ['Monday', [AIML_B9, AIML_B8, null, AIML_B9]],
      ['Tuesday', [AIML_B6, AIML_B7, AIML_B7, AIML_B8]],
      ['Wednesday', [AIML_B7, AIML_B6, AIML_B9, AIML_B6]],
      ['Thursday', [AIML_B7, null, AIML_B9, null]],
      ['Friday', [AIML_B8, AIML_B6, AIML_B8, null]],
    ],
  },
  {
    trainerCode: 'IDSA-T4',
    subjectKind: 'IDSA',
    rows: [
      ['Monday', [AIML_B10, AIML_B10, DS_1, null]],
      ['Tuesday', [AIML_B10, DS_1, null, DS_2_ECM]],
      ['Wednesday', [AIML_B11, AIML_B10, DS_2_ECM, AIML_B11]],
      ['Thursday', [DS_2_ECM, DS_2_ECM, AIML_B11, DS_1]],
      ['Friday', [null, AIML_B11, null, DS_1]],
    ],
  },
  {
    trainerCode: 'PEDH- T03',
    subjectKind: 'PEDH',
    rows: [
      ['Monday', [AIML_B11, DS_2_ECM, AIML_B11, DS_1]],
      ['Tuesday', [null, AIML_B11, AIML_B10, DS_1]],
      ['Wednesday', [DS_2_ECM, null, null, AIML_B10]],
      ['Thursday', [AIML_B11, DS_1, AIML_B10, DS_2_ECM]],
      ['Friday', [null, DS_1, DS_2_ECM, AIML_B10]],
    ],
  },
  {
    trainerCode: 'PEDH- T06',
    subjectKind: 'PEDH',
    rows: [
      ['Monday', [AI_DS_1, null, CS_CS1, CS_CS2]],
      ['Tuesday', [AI_DS_1, IT_IT, AI_DS_1, IT_IT]],
      ['Wednesday', [IT_IT, CS_CS1, CS_CS2, CS_CS1]],
      ['Thursday', [null, AI_DS_1, null, CS_CS2]],
      ['Friday', [CS_CS1, CS_CS2, IT_IT, null]],
    ],
  },
  {
    trainerCode: 'IDSA-T3',
    subjectKind: 'IDSA',
    rows: [
      ['Monday', [null, IT_IT, CS_CS2, AI_DS_1]],
      ['Tuesday', [CS_CS1, CS_CS2, null, CS_CS1]],
      ['Wednesday', [AI_DS_1, null, IT_IT, IT_IT]],
      ['Thursday', [CS_CS2, CS_CS1, CS_CS1, IT_IT]],
      ['Friday', [null, AI_DS_1, AI_DS_1, CS_CS2]],
    ],
  },
];

export const TRAINER_TIMETABLE_CODES = TRAINER_TIMETABLE_DEFINITIONS.map(
  ({ trainerCode }) => trainerCode
);

export const buildIIIsemesterSchedulePayloads = () =>
  TRAINER_TIMETABLE_DEFINITIONS.flatMap(expandTrainer).map((item) => ({
    ...item,
    semester: III_SEMESTER,
  }));
