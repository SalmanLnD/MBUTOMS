import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Venue from '../models/Venue.js';
import { PSTP_SUBJECT } from '../utils/trainerMappings.js';
import {
  buildPstpSchedulePayloads,
  PSTP_T8_TRAINER_CODE,
  PSTP_T9_TRAINER_CODE,
} from '../utils/pstpTimetable.js';
import {
  PSTP_VENUE_BUILDING,
  PSTP_VENUE_NUMBERS,
  PSTP_VENUE_TRAINER_CODES,
  resolvePstpVenueNumber,
  venueNumberToName,
  defaultVenueTypeForNumber,
} from '../utils/pstpVenueMappings.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const pstpSubject = await Subject.findOne({ code: PSTP_SUBJECT.code });
if (!pstpSubject) {
  throw new Error(`PSTP subject not found (${PSTP_SUBJECT.code})`);
}

const venueByNumber = new Map();
for (const venueNumber of PSTP_VENUE_NUMBERS) {
  const name = venueNumberToName(venueNumber);
  const venue = await Venue.findOneAndUpdate(
    { name, building: PSTP_VENUE_BUILDING },
    {
      name,
      building: PSTP_VENUE_BUILDING,
      floor: '',
      capacity: 60,
      type: defaultVenueTypeForNumber(venueNumber),
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  venueByNumber.set(venueNumber, venue._id);
}
console.log(`Ensured ${venueByNumber.size} PSTP venue(s).`);

const removed = await Schedule.deleteMany({
  trainerCode: { $in: [PSTP_T8_TRAINER_CODE, PSTP_T9_TRAINER_CODE] },
});

const payloads = buildPstpSchedulePayloads().map((entry) => ({
  ...entry,
  subject: pstpSubject._id,
}));

const created = await Schedule.insertMany(payloads);
console.log(`Removed ${removed.deletedCount} old PSTP slot(s), inserted ${created.length}.`);

let mapped = 0;
for (const schedule of created) {
  const venueNumber = resolvePstpVenueNumber(schedule.trainerCode, schedule.day, schedule.slot);
  if (!venueNumber) continue;
  const venueId = venueByNumber.get(venueNumber);
  if (!venueId) continue;
  schedule.venue = venueId;
  await schedule.save();
  mapped += 1;
}
console.log(`Mapped ${mapped} PSTP slot(s) to venues.`);

for (const code of PSTP_VENUE_TRAINER_CODES) {
  const withVenue = await Schedule.countDocuments({
    trainerCode: code,
    venue: { $ne: null },
  });
  const total = await Schedule.countDocuments({ trainerCode: code });
  console.log(`${code}: ${withVenue}/${total} slots with venue`);
}

await mongoose.disconnect();
