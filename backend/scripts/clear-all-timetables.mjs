import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import { clearAllTimetableSchedules } from '../utils/clearAllTimetableSchedules.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const before = {
  schedules: await Schedule.countDocuments(),
  trainersWithSubjects: await Trainer.countDocuments({
    subjects: { $exists: true, $not: { $size: 0 } },
  }),
  subjectsWithTrainers: await Subject.countDocuments({
    trainerEligible: { $exists: true, $not: { $size: 0 } },
  }),
};

console.log('Before:', before);

const summary = await clearAllTimetableSchedules();
console.log('Deleted:', summary);

const after = {
  schedules: await Schedule.countDocuments(),
  trainersWithSubjects: await Trainer.countDocuments({
    subjects: { $exists: true, $not: { $size: 0 } },
  }),
  subjectsWithTrainers: await Subject.countDocuments({
    trainerEligible: { $exists: true, $not: { $size: 0 } },
  }),
};

console.log('After:', after);

await mongoose.disconnect();
