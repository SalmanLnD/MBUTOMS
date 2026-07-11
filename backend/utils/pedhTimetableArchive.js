import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PEDH_SUBJECT } from './trainerMappings.js';
import { SOC_FOUR_SLOT_TIMINGS } from './subjectSlotTimings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PEDH_ARCHIVED_SEMESTER = 'III';

/** Legacy trainer codes T01–T07. PEDH subject retired — kept for reference only. */
export const PEDH_ARCHIVED_TRAINER_CODES = [
  'PEDH- T01',
  'PEDH- T02',
  'PEDH- T03',
  'PEDH- T04',
  'PEDH- T05',
  'PEDH- T06',
  'PEDH- T07',
];

/** Trainers who remain on roster but have no active timetable slots. */
export const PEDH_SLOTLESS_TRAINER_CODES = [
  'PEDH- T01',
  'PEDH- T02',
  'PEDH- T04',
  'PEDH- T05',
];

export const PEDH_ARCHIVED_TRAINER_NAMES = {
  'PEDH- T01': 'Megha Sree S',
  'PEDH- T02': 'Sumit Kumar Gupta',
  'PEDH- T03': 'Mahendra Urumu',
  'PEDH- T04': 'Viswateja Jana',
  'PEDH- T05': 'Rahmathullah Shaik',
  'PEDH- T06': 'PEDH- T06',
  'PEDH- T07': 'PEDH- T07',
};

const toSlot = (slotKey) => {
  const timing = SOC_FOUR_SLOT_TIMINGS[slotKey.toLowerCase()];
  return {
    slot: slotKey,
    startTime: timing.startTime,
    endTime: timing.endTime,
    subjectCode: PEDH_SUBJECT.code,
  };
};

const pedh = (slotKey) => toSlot(slotKey);

const cls = (department, section) => ({ department, section });

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

const entry = (trainerCode, day, slotKey, classInfo) => ({
  trainerCode,
  day,
  ...classInfo,
  ...pedh(slotKey),
});

const expandTrainer = ({ trainerCode, rows }) =>
  rows.flatMap(([day, slots]) =>
    slots.flatMap((classInfo, index) =>
      classInfo ? [entry(trainerCode, day, `S${index + 1}`, classInfo)] : []
    )
  );

/** Grid-based archived timetables (T01, T03–T06) formerly in iiiSemesterTimetables. */
export const PEDH_GRID_ARCHIVED_DEFINITIONS = [
  {
    trainerCode: 'PEDH- T01',
    rows: [
      ['Monday', [AIML_B9, AIML_B8, null, AIML_B9]],
      ['Tuesday', [AIML_B6, AIML_B7, AIML_B7, AIML_B8]],
      ['Wednesday', [AIML_B7, AIML_B6, AIML_B9, AIML_B6]],
      ['Thursday', [AIML_B7, null, AIML_B9, null]],
      ['Friday', [AIML_B8, AIML_B6, AIML_B8, null]],
    ],
  },
  {
    trainerCode: 'PEDH- T03',
    rows: [
      ['Monday', [AIML_B11, DS_2_ECM, AIML_B11, DS_1]],
      ['Tuesday', [null, AIML_B11, AIML_B10, DS_1]],
      ['Wednesday', [DS_2_ECM, null, null, AIML_B10]],
      ['Thursday', [AIML_B11, DS_1, AIML_B10, DS_2_ECM]],
      ['Friday', [null, DS_1, DS_2_ECM, AIML_B10]],
    ],
  },
  {
    trainerCode: 'PEDH- T04',
    rows: [
      ['Monday', [AIML_B1, CSE_A6_DEVOPS, CSE_A5, CSE_A5]],
      ['Tuesday', [null, CSE_A7_CC, AIML_B1, null]],
      ['Wednesday', [CSE_A6_DEVOPS, null, AIML_B1, CSE_A7_CC]],
      ['Thursday', [CSE_A5, null, CSE_A6_DEVOPS, CSE_A7_CC]],
      ['Friday', [CSE_A6_DEVOPS, CSE_A7_CC, CSE_A5, AIML_B1]],
    ],
  },
  {
    trainerCode: 'PEDH- T05',
    rows: [
      ['Monday', [AIML_B3, AIML_B4, AIML_B3, AIML_B2]],
      ['Tuesday', [AIML_B5, AIML_B2, AIML_B5, AIML_B4]],
      ['Wednesday', [AIML_B4, AIML_B3, AIML_B4, AIML_B5]],
      ['Thursday', [null, AIML_B2, null, AIML_B2]],
      ['Friday', [AIML_B3, null, AIML_B5, null]],
    ],
  },
  {
    trainerCode: 'PEDH- T06',
    rows: [
      ['Monday', [AI_DS_1, null, CS_CS1, CS_CS2]],
      ['Tuesday', [AI_DS_1, IT_IT, AI_DS_1, IT_IT]],
      ['Wednesday', [IT_IT, CS_CS1, CS_CS2, CS_CS1]],
      ['Thursday', [null, AI_DS_1, null, CS_CS2]],
      ['Friday', [CS_CS1, CS_CS2, IT_IT, null]],
    ],
  },
];

const loadFlatArchivedSlots = () => {
  const raw = JSON.parse(
    readFileSync(join(__dirname, '../data/schedules-iii-sem.json'), 'utf8')
  );
  return raw
    .filter((entry) => ['PEDH- T02', 'PEDH- T07'].includes(entry.trainerCode))
    .map((entry) => ({
      ...entry,
      subjectCode: PEDH_SUBJECT.code,
    }));
};

/** Flat archived slots for T02 and T07 (not in the grid definitions). */
export const PEDH_FLAT_ARCHIVED_SLOTS = loadFlatArchivedSlots();

export const buildPedhArchivedSchedulePayloads = () => [
  ...PEDH_GRID_ARCHIVED_DEFINITIONS.flatMap(expandTrainer).map((item) => ({
    ...item,
    semester: PEDH_ARCHIVED_SEMESTER,
  })),
  ...PEDH_FLAT_ARCHIVED_SLOTS.map((item) => ({
    ...item,
    semester: item.semester || PEDH_ARCHIVED_SEMESTER,
  })),
];
