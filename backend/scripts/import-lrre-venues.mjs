import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Venue from '../models/Venue.js';
import {
  LRRE_VENUE_BUILDING,
  LRRE_VENUE_NUMBERS,
  LRRE_SUBJECT_CODE,
  LRRE_V_TRAINER_EMPLOYEE_IDS,
  LRRE_TRAINER_VENUE_SLOTS,
  resolveLrreVenueNumber,
  venueNumberToName,
  defaultVenueTypeForNumber,
} from '../utils/lrreVenueMappings.js';
import { LRRE_V_TRAINER_ALLOCATIONS } from '../utils/lrreVSemesterTimetable.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const venueByNumber = new Map();

for (const venueNumber of LRRE_VENUE_NUMBERS) {
  const name = venueNumberToName(venueNumber);
  const venue = await Venue.findOneAndUpdate(
    { name, building: LRRE_VENUE_BUILDING },
    {
      name,
      building: LRRE_VENUE_BUILDING,
      floor: '',
      capacity: 60,
      type: defaultVenueTypeForNumber(venueNumber),
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  venueByNumber.set(venueNumber, venue._id);
}

console.log(`Ensured ${venueByNumber.size} LRRE venue(s) with building "${LRRE_VENUE_BUILDING}".`);

const schedules = await Schedule.find({
  trainerCode: { $in: LRRE_V_TRAINER_EMPLOYEE_IDS },
  subjectCode: LRRE_SUBJECT_CODE,
});

let mapped = 0;
let cleared = 0;
let missing = 0;

for (const schedule of schedules) {
  const venueNumber = resolveLrreVenueNumber(schedule.trainerCode, schedule.day, schedule.slot);
  if (!venueNumber) {
    if (schedule.venue) {
      schedule.venue = null;
      await schedule.save();
      cleared += 1;
    } else {
      missing += 1;
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

console.log(`Mapped ${mapped} LRRE slot(s) to venues. Cleared ${cleared}. Unmapped slots: ${missing}.`);

for (const employeeId of LRRE_V_TRAINER_EMPLOYEE_IDS) {
  const allocation = LRRE_V_TRAINER_ALLOCATIONS[employeeId];
  const expected = LRRE_TRAINER_VENUE_SLOTS[employeeId]?.length || 0;
  const withVenue = await Schedule.countDocuments({
    trainerCode: employeeId,
    subjectCode: LRRE_SUBJECT_CODE,
    venue: { $ne: null },
  });
  console.log(`${allocation.name}: ${withVenue}/${expected} slots with venue`);
}

await mongoose.disconnect();
