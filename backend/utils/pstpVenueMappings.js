import {
  PSTP_T8_TRAINER_CODE,
  PSTP_T9_TRAINER_CODE,
} from './pstpTimetable.js';

/** Building/block not declared yet — placeholder until campus blocks are confirmed. */
export const PSTP_VENUE_BUILDING = 'TBD';

/** Per-slot venue numbers from PSTP T15/T16 timetables. */
export const PSTP_TRAINER_VENUE_SLOTS = {
  [PSTP_T8_TRAINER_CODE]: [
    { day: 'Monday', slot: 'S1', venue: '323' },
    { day: 'Monday', slot: 'S2', venue: '322' },
    { day: 'Monday', slot: 'S3', venue: '323' },
    { day: 'Tuesday', slot: 'S1', venue: '322' },
    { day: 'Tuesday', slot: 'S3', venue: '324' },
    { day: 'Tuesday', slot: 'S4', venue: '322' },
    { day: 'Wednesday', slot: 'S1', venue: '324' },
    { day: 'Wednesday', slot: 'S2', venue: '322' },
    { day: 'Wednesday', slot: 'S3', venue: '321' },
    { day: 'Wednesday', slot: 'S4', venue: '321' },
    { day: 'Thursday', slot: 'S1', venue: '323' },
    { day: 'Thursday', slot: 'S2', venue: '324' },
    { day: 'Thursday', slot: 'S3', venue: '323' },
    { day: 'Thursday', slot: 'S4', venue: '324' },
    { day: 'Friday', slot: 'S3', venue: '321' },
    { day: 'Friday', slot: 'S4', venue: '321' },
  ],
  [PSTP_T9_TRAINER_CODE]: [
    { day: 'Monday', slot: 'S1', venue: '2603' },
    { day: 'Monday', slot: 'S3', venue: '4220' },
    { day: 'Monday', slot: 'S4', venue: '2603' },
    { day: 'Tuesday', slot: 'S1', venue: '207' },
    { day: 'Tuesday', slot: 'S2', venue: '123A' },
    { day: 'Tuesday', slot: 'S3', venue: '132' },
    { day: 'Tuesday', slot: 'S4', venue: '4220' },
    { day: 'Wednesday', slot: 'S1', venue: '4220' },
    { day: 'Wednesday', slot: 'S2', venue: '2603' },
    { day: 'Wednesday', slot: 'S3', venue: '132' },
    { day: 'Wednesday', slot: 'S4', venue: '132' },
    { day: 'Thursday', slot: 'S1', venue: '123A' },
    { day: 'Thursday', slot: 'S2', venue: '4220' },
    { day: 'Thursday', slot: 'S3', venue: '2603' },
    { day: 'Friday', slot: 'S3', venue: '207' },
    { day: 'Friday', slot: 'S4', venue: '132' },
  ],
};

export const PSTP_VENUE_NUMBERS = [
  ...new Set(
    Object.values(PSTP_TRAINER_VENUE_SLOTS)
      .flat()
      .map((entry) => entry.venue)
  ),
];

export const venueNumberToName = (venueNumber) => String(venueNumber);

export const defaultVenueTypeForNumber = () => 'classroom';

export const resolvePstpVenueNumber = (trainerCode, day, slot) => {
  const entries = PSTP_TRAINER_VENUE_SLOTS[String(trainerCode || '').trim()];
  if (!entries) return null;
  const match = entries.find((entry) => entry.day === day && entry.slot === slot);
  return match?.venue ?? null;
};

export const PSTP_VENUE_TRAINER_CODES = Object.keys(PSTP_TRAINER_VENUE_SLOTS);
