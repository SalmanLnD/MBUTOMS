import { IDSA_SUBJECT } from './trainerMappings.js';
import { NAVYA_TRAINER_CODE } from './navyaTimetable.js';

/** Building/block not declared yet — placeholder until campus blocks are confirmed. */
export const IDSA_VENUE_BUILDING = 'TBD';

export const IDSA_VENUE_NUMBERS = [
  333, 513, 514, 612, 618, 709, 2854, 4015, 4202, 4203, 4204,
  4316, 4317, 4318, 4319, 4320, 4321, 4322, 4324, 4400, 4401,
];

const SLOT_INDEX = { S1: 0, S2: 1, S3: 2, S4: 3 };

/**
 * Venue numbers per day and slot (S1–S4). null = no venue / not declared.
 * Keys use system trainer codes (spreadsheet IDSA T# differs from legacy codes).
 */
export const IDSA_TRAINER_VENUE_GRIDS = {
  'IDSA-T1': {
    Monday: [4203, 4203, 4202, null],
    Tuesday: [4202, 4203, 4203, 4203],
    Wednesday: [4203, 4203, 4203, 4203],
    Thursday: [4204, 4202, 4202, null],
    Friday: [4203, null, null, 4202],
  },
  'IDSA-T5': {
    Monday: [4015, 4400, null, null],
    Tuesday: [4204, null, 4015, 4204],
    Wednesday: [4400, 2854, 4204, 4015],
    Thursday: [333, 4015, 4400, 4400],
    Friday: [4204, 4204, 4204, null],
  },
  'IDSA-T7': {
    Monday: [null, 4401, 4401, 4324],
    Tuesday: [4401, 4401, 4324, null],
    Wednesday: [4324, null, 4401, 4401],
    Thursday: [4400, 4324, null, 4324],
    Friday: [4324, 4401, 4401, 4324],
  },
  'IDSA-T6': {
    Monday: [4322, 4320, 4324, null],
    Tuesday: [4321, null, 4320, null],
    Wednesday: [4320, 4322, 4321, 4320],
    Thursday: [4324, 4322, null, 4321],
    Friday: [4322, 4322, 4322, 4322],
  },
  'IDSA-T4': {
    Monday: [4319, 4319, 513, null],
    Tuesday: [4320, 513, null, 514],
    Wednesday: [4319, 4321, 514, 4318],
    Thursday: [514, 514, 4320, null],
    Friday: [null, 4320, 513, null],
  },
  'IDSA-T3': {
    Monday: [null, 709, 618, 4320],
    Tuesday: [612, 618, null, 612],
    Wednesday: [4318, null, 709, 709],
    Thursday: [618, 612, 612, 709],
    Friday: [null, 4319, 4320, 618],
  },
};

/** Navya (IDSA-T2) IDSA slots only — B.COM/PSTJ venues left empty. */
export const NAVYA_IDSA_VENUE_SLOTS = [
  { day: 'Monday', slot: 'S1', venue: 4316 },
  { day: 'Monday', slot: 'S2', venue: 4317 },
  { day: 'Tuesday', slot: 'S1', venue: 4316 },
  { day: 'Tuesday', slot: 'S2', venue: 4319 },
  { day: 'Wednesday', slot: 'S1', venue: 4317 },
  { day: 'Thursday', slot: 'S1', venue: 4318 },
  { day: 'Thursday', slot: 'S2', venue: 4319 },
  { day: 'Friday', slot: 'S3', venue: 4319 },
];

export const IDSA_VENUE_TRAINER_CODES = [
  ...Object.keys(IDSA_TRAINER_VENUE_GRIDS),
  NAVYA_TRAINER_CODE,
];

export const getVenueNumberForGridSlot = (trainerCode, day, slot) => {
  const grid = IDSA_TRAINER_VENUE_GRIDS[trainerCode];
  if (!grid) return null;
  const row = grid[day];
  if (!row) return null;
  const index = SLOT_INDEX[slot];
  if (index === undefined) return null;
  return row[index] ?? null;
};

export const getVenueNumberForNavyaIdsaSlot = (day, slot) => {
  const match = NAVYA_IDSA_VENUE_SLOTS.find((entry) => entry.day === day && entry.slot === slot);
  return match?.venue ?? null;
};

export const resolveIdsaVenueNumber = (trainerCode, day, slot) => {
  if (trainerCode === NAVYA_TRAINER_CODE) {
    return getVenueNumberForNavyaIdsaSlot(day, slot);
  }
  return getVenueNumberForGridSlot(trainerCode, day, slot);
};

export const venueNumberToName = (venueNumber) => String(venueNumber);

export const defaultVenueTypeForNumber = (venueNumber) => {
  if ([4400, 4401].includes(venueNumber)) return 'lab';
  return 'classroom';
};

export const IDSA_SUBJECT_CODE = IDSA_SUBJECT.code;
