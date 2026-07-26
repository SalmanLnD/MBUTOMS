import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import {
  IDSA_VENUE_NUMBERS,
  IDSA_VENUE_TRAINER_CODES,
  IDSA_SUBJECT_CODE,
  NAVYA_IDSA_VENUE_SLOTS,
  NAVYA_PSTJ_VENUE_SLOTS,
  resolveIdsaVenueNumber,
  getVenueNumberForNavyaPstjSlot,
  defaultVenueTypeForNumber,
} from '../utils/idsaVenueMappings.js';
import { upsertVenueByNumber } from '../utils/venueUpsert.js';
import { NAVYA_TRAINER_CODE } from '../utils/navyaTimetable.js';
import { PSTJ_SUBJECT_CODE } from '../utils/subjectSlotTimings.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const venueByNumber = new Map();

for (const venueNumber of IDSA_VENUE_NUMBERS) {
  const venue = await upsertVenueByNumber(venueNumber, {
    capacity: 60,
    type: defaultVenueTypeForNumber(venueNumber),
    isActive: true,
  });
  venueByNumber.set(venueNumber, venue._id);
}

console.log(`Ensured ${venueByNumber.size} IDSA/PSTJ venue(s) with mapped building details.`);

let mapped = 0;
let cleared = 0;

const idsaSchedules = await Schedule.find({
  trainerCode: { $in: IDSA_VENUE_TRAINER_CODES },
  subjectCode: IDSA_SUBJECT_CODE,
});

for (const schedule of idsaSchedules) {
  const venueNumber = resolveIdsaVenueNumber(schedule.trainerCode, schedule.day, schedule.slot);
  if (!venueNumber) {
    if (schedule.venue) {
      schedule.venue = null;
      await schedule.save();
      cleared += 1;
    }
    continue;
  }

  const venueId = venueByNumber.get(venueNumber);
  if (!venueId) {
    console.warn(`Missing venue record for room ${venueNumber}`);
    continue;
  }

  if (schedule.venue?.toString() !== venueId.toString()) {
    schedule.venue = venueId;
    await schedule.save();
    mapped += 1;
  }
}

const pstjSchedules = await Schedule.find({
  trainerCode: NAVYA_TRAINER_CODE,
  subjectCode: PSTJ_SUBJECT_CODE,
});

for (const schedule of pstjSchedules) {
  const venueNumber = getVenueNumberForNavyaPstjSlot(schedule.day, schedule.slot);
  if (!venueNumber) {
    if (schedule.venue) {
      schedule.venue = null;
      await schedule.save();
      cleared += 1;
    }
    continue;
  }

  const venueId = venueByNumber.get(venueNumber);
  if (!venueId) {
    console.warn(`Missing venue record for room ${venueNumber}`);
    continue;
  }

  if (schedule.venue?.toString() !== venueId.toString()) {
    schedule.venue = venueId;
    await schedule.save();
    mapped += 1;
  }
}

console.log(`Mapped ${mapped} slot(s) to venues. Cleared ${cleared} slot(s) without venue.`);

const navyaIdsaCount = await Schedule.countDocuments({
  trainerCode: NAVYA_TRAINER_CODE,
  subjectCode: IDSA_SUBJECT_CODE,
  venue: { $ne: null },
});
const navyaPstjWithVenue = await Schedule.countDocuments({
  trainerCode: NAVYA_TRAINER_CODE,
  subjectCode: PSTJ_SUBJECT_CODE,
  venue: { $ne: null },
});

console.log(`Navya IDSA slots with venue: ${navyaIdsaCount} (expected ${NAVYA_IDSA_VENUE_SLOTS.length}).`);
console.log(`Navya PSTJ slots with venue: ${navyaPstjWithVenue} (expected ${NAVYA_PSTJ_VENUE_SLOTS.length}).`);

await mongoose.disconnect();
