import {
  LRRE_SUBJECT_CODE,
  LRRE_V_TRAINER_EMPLOYEE_IDS,
} from './lrreVSemesterTimetable.js';

/** Building/block not declared yet — placeholder until campus blocks are confirmed. */
export const LRRE_VENUE_BUILDING = 'TBD';

/** Per-slot venue numbers from LRRE T1–T6 timetables (R. prefix ignored). */
export const LRRE_TRAINER_VENUE_SLOTS = {
  /** LRRE T1 — Ravi Teja Naga Kumar */
  '135130': [
    { day: 'Monday', slot: 'S1', venue: 4017 },
    { day: 'Monday', slot: 'S3', venue: 4017 },
    { day: 'Tuesday', slot: 'S1', venue: 4017 },
    { day: 'Tuesday', slot: 'S2', venue: 4016 },
    { day: 'Tuesday', slot: 'S3', venue: 4200 },
    { day: 'Wednesday', slot: 'S1', venue: 4200 },
    { day: 'Wednesday', slot: 'S2', venue: 4017 },
    { day: 'Wednesday', slot: 'S3', venue: 4017 },
    { day: 'Thursday', slot: 'S1', venue: 4017 },
    { day: 'Thursday', slot: 'S2', venue: 4017 },
    { day: 'Friday', slot: 'S1', venue: 4017 },
    { day: 'Friday', slot: 'S2', venue: 4018 },
  ],
  /** LRRE T2 — Naga Sai Kamesh T */
  '135621': [
    { day: 'Monday', slot: 'S1', venue: 4202 },
    { day: 'Monday', slot: 'S2', venue: 4200 },
    { day: 'Monday', slot: 'S3', venue: 4318 },
    { day: 'Tuesday', slot: 'S1', venue: 4201 },
    { day: 'Tuesday', slot: 'S2', venue: 4201 },
    { day: 'Tuesday', slot: 'S3', venue: 712 },
    { day: 'Wednesday', slot: 'S2', venue: 4201 },
    { day: 'Wednesday', slot: 'S3', venue: 4202 },
    { day: 'Thursday', slot: 'S1', venue: 4201 },
    { day: 'Thursday', slot: 'S2', venue: 4318 },
    { day: 'Friday', slot: 'S1', venue: 4201 },
    { day: 'Friday', slot: 'S2', venue: 4317 },
  ],
  /** LRRE T3 — Akuthota Praharsha */
  '136047': [
    { day: 'Monday', slot: 'S1', venue: 4304 },
    { day: 'Monday', slot: 'S3', venue: 812 },
    { day: 'Tuesday', slot: 'S1', venue: 4304 },
    { day: 'Tuesday', slot: 'S3', venue: 801 },
    { day: 'Wednesday', slot: 'S1', venue: 4303 },
    { day: 'Wednesday', slot: 'S2', venue: 4316 },
    { day: 'Wednesday', slot: 'S3', venue: 811 },
    { day: 'Thursday', slot: 'S1', venue: 4304 },
    { day: 'Thursday', slot: 'S2', venue: 4316 },
    { day: 'Friday', slot: 'S1', venue: 4317 },
    { day: 'Friday', slot: 'S2', venue: 4316 },
    { day: 'Friday', slot: 'S3', venue: 816 },
  ],
  /** LRRE T4 — Thanneru Laxmi Priya */
  '135517': [
    { day: 'Monday', slot: 'S1', venue: 4303 },
    { day: 'Monday', slot: 'S2', venue: 4118 },
    { day: 'Monday', slot: 'S3', venue: 4114 },
    { day: 'Tuesday', slot: 'S1', venue: 4113 },
    { day: 'Tuesday', slot: 'S2', venue: 4120 },
    { day: 'Wednesday', slot: 'S1', venue: 4315 },
    { day: 'Wednesday', slot: 'S2', venue: 4315 },
    { day: 'Wednesday', slot: 'S3', venue: 4113 },
    { day: 'Thursday', slot: 'S1', venue: 4303 },
    { day: 'Thursday', slot: 'S3', venue: 4316 },
    { day: 'Friday', slot: 'S1', venue: 4114 },
    { day: 'Friday', slot: 'S2', venue: 4118 },
  ],
  /** LRRE T5 — Harinisree */
  '801406': [
    { day: 'Monday', slot: 'S2', venue: 519 },
    { day: 'Tuesday', slot: 'S1', venue: 327 },
    { day: 'Tuesday', slot: 'S2', venue: 4115 },
    { day: 'Tuesday', slot: 'S3', venue: 4116 },
    { day: 'Wednesday', slot: 'S1', venue: 519 },
    { day: 'Wednesday', slot: 'S2', venue: 4115 },
    { day: 'Wednesday', slot: 'S3', venue: 328 },
    { day: 'Thursday', slot: 'S2', venue: 609 },
    { day: 'Thursday', slot: 'S3', venue: 327 },
    { day: 'Friday', slot: 'S1', venue: 4116 },
    { day: 'Friday', slot: 'S2', venue: 328 },
    { day: 'Friday', slot: 'S3', venue: 609 },
  ],
  /** LRRE T6 — Barath M */
  '135402': [
    { day: 'Monday', slot: 'S1', venue: 328 },
    { day: 'Monday', slot: 'S2', venue: 2706 },
    { day: 'Monday', slot: 'S3', venue: 330 },
    { day: 'Tuesday', slot: 'S1', venue: 330 },
    { day: 'Tuesday', slot: 'S2', venue: 230 },
    { day: 'Tuesday', slot: 'S3', venue: 423 },
    { day: 'Wednesday', slot: 'S3', venue: 330 },
    { day: 'Thursday', slot: 'S1', venue: 423 },
    { day: 'Thursday', slot: 'S2', venue: 230 },
    { day: 'Thursday', slot: 'S3', venue: 2706 },
    { day: 'Friday', slot: 'S1', venue: 423 },
    { day: 'Friday', slot: 'S3', venue: 423 },
  ],
};

export const LRRE_VENUE_NUMBERS = [
  ...new Set(
    Object.values(LRRE_TRAINER_VENUE_SLOTS)
      .flat()
      .map((entry) => entry.venue)
  ),
].sort((a, b) => a - b);

export const venueNumberToName = (venueNumber) => String(venueNumber);

export const defaultVenueTypeForNumber = () => 'classroom';

export const resolveLrreVenueNumber = (trainerCode, day, slot) => {
  const entries = LRRE_TRAINER_VENUE_SLOTS[String(trainerCode || '').trim()];
  if (!entries) return null;
  const match = entries.find((entry) => entry.day === day && entry.slot === slot);
  return match?.venue ?? null;
};

export { LRRE_SUBJECT_CODE, LRRE_V_TRAINER_EMPLOYEE_IDS };
