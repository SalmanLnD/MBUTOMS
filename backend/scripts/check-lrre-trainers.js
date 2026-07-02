import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { syncAllTrainerSubjectLinks } from '../utils/syncTrainerSubjectLinks.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const sync = await syncAllTrainerSubjectLinks();
const lrre = await Subject.findOne({ code: '22LG101703' }).populate('trainerEligible', 'name employeeId');
const ravi = await Trainer.findOne({ employeeId: '135130' }).populate('subjects', 'name code');

console.log('sync', sync);
console.log('LRRE eligible trainers:', lrre?.trainerEligible?.map((t) => t.name));
console.log('Ravi profile subjects:', ravi?.subjects?.map((s) => s.name));

const timetableSubjects = await Subject.find({
  $or: [{ trainerEligible: ravi._id }, { _id: { $in: ravi.subjects } }],
});
console.log('Timetable subjects for Ravi:', timetableSubjects.map((s) => s.name));

await mongoose.disconnect();
