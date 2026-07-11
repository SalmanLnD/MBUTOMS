import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Venue from '../models/Venue.js';
import {
  IDSA_VENUE_BUILDING,
  IDSA_VENUE_NUMBERS,
  IDSA_VENUE_TRAINER_CODES,
  IDSA_SUBJECT_CODE,
  NAVYA_IDSA_VENUE_SLOTS,
  resolveIdsaVenueNumber,
  venueNumberToName,
  defaultVenueTypeForNumber,
} from '../utils/idsaVenueMappings.js';
import { NAVYA_TRAINER_CODE } from '../utils/navyaTimetable.js';
import { PSTJ_SUBJECT_CODE } from '../utils/subjectSlotTimings.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const venueByNumber = new Map();

for (const venueNumber of IDSA_VENUE_NUMBERS) {
  const name = venueNumberToName(venueNumber);
  const venue = await Venue.findOneAndUpdate(
    { name, building: IDSA_VENUE_BUILDING },
    {
      name,
      building: IDSA_VENUE_BUILDING,
      floor: '',
      capacity: 60,
      type: defaultVenueTypeForNumber(venueNumber),
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  venueByNumber.set(venueNumber, venue._id);
}

console.log(`Ensured ${venueByNumber.size} venue(s) with building "${IDSA_VENUE_BUILDING}".`);

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
  venue: { $ne: null },
});

for (const schedule of pstjSchedules) {
  schedule.venue = null;
  await schedule.save();
  cleared += 1;
}

console.log(`Mapped ${mapped} IDSA slot(s) to venues. Cleared ${cleared} slot(s) without venue.`);

const navyaIdsaCount = await Schedule.countDocuments({
  trainerCode: NAVYA_TRAINER_CODE,
  subjectCode: IDSA_SUBJECT_CODE,
  venue: { $ne: null },
});
const navyaPstjWithoutVenue = await Schedule.countDocuments({
  trainerCode: NAVYA_TRAINER_CODE,
  subjectCode: PSTJ_SUBJECT_CODE,
  venue: null,
});

console.log(`Navya IDSA slots with venue: ${navyaIdsaCount} (expected ${NAVYA_IDSA_VENUE_SLOTS.length}).`);
console.log(`Navya PSTJ slots without venue: ${navyaPstjWithoutVenue}.`);

await mongoose.disconnect();
