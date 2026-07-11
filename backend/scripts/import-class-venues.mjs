import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Venue from '../models/Venue.js';
import {
  CLASS_VENUE_BUILDING,
  CLASS_VENUE_NUMBERS,
  SAI_PRIYA_SCHEDULE_CODE,
  resolveClassVenueNumber,
  venueNumberToName,
  defaultVenueTypeForNumber,
} from '../utils/classVenueMappings.js';
import { ADMIN_TRAINER_EMPLOYEE_ID } from '../utils/trainerMappings.js';
import { QAVA_TRAINER_EMPLOYEE_ID } from '../utils/qavaTimetable.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const venueByNumber = new Map();

for (const venueNumber of CLASS_VENUE_NUMBERS) {
  const name = venueNumberToName(venueNumber);
  const venue = await Venue.findOneAndUpdate(
    { name, building: CLASS_VENUE_BUILDING },
    {
      name,
      building: CLASS_VENUE_BUILDING,
      floor: '',
      capacity: 60,
      type: defaultVenueTypeForNumber(venueNumber),
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  venueByNumber.set(venueNumber, venue._id);
}

console.log(`Ensured ${venueByNumber.size} venue(s) with building "${CLASS_VENUE_BUILDING}".`);

const schedules = await Schedule.find({
  trainerCode: { $in: [SAI_PRIYA_SCHEDULE_CODE, QAVA_TRAINER_EMPLOYEE_ID, ADMIN_TRAINER_EMPLOYEE_ID] },
});

let mapped = 0;
let cleared = 0;

for (const schedule of schedules) {
  const venueNumber = resolveClassVenueNumber(schedule);
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

console.log(`Mapped ${mapped} slot(s) to venues. Cleared ${cleared} slot(s).`);

const saiBySection = {};
const saiSchedules = await Schedule.find({ trainerCode: SAI_PRIYA_SCHEDULE_CODE }).populate('venue', 'name');
for (const s of saiSchedules) {
  const key = s.section;
  if (!saiBySection[key]) saiBySection[key] = s.venue?.name || '(none)';
}
console.log('Sai Priya venues by section:', saiBySection);

const suryaBySection = {};
const suryaSchedules = await Schedule.find({ trainerCode: QAVA_TRAINER_EMPLOYEE_ID }).populate('venue', 'name');
for (const s of suryaSchedules) {
  const key = s.section;
  if (!suryaBySection[key]) suryaBySection[key] = s.venue?.name || '(none)';
}
console.log('Surya Deo venues by section:', suryaBySection);

const adminMca = await Schedule.find({
  trainerCode: ADMIN_TRAINER_EMPLOYEE_ID,
  department: 'MCA',
}).populate('venue', 'name');
adminMca.forEach((s) => {
  console.log(`Admin MCA: ${s.day} ${s.slot} venue ${s.venue?.name || '(none)'}`);
});

await mongoose.disconnect();
