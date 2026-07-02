import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import { resolveSaiPriyaSubjectCode } from '../utils/trainerMappings.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const schedules = await Schedule.find({ trainerCode: 'PEDH- T07' }).sort({ day: 1, startTime: 1 });
schedules.forEach((s) => {
  const resolved = resolveSaiPriyaSubjectCode(s);
  console.log(s.day, s.startTime, s.department, s.section, 'db:', s.subjectCode, 'resolved:', resolved);
});

await mongoose.disconnect();
