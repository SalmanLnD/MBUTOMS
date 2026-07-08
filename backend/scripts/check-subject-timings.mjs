import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import Schedule from '../models/Schedule.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const codes = ['22LG101702', '22LG101703'];
const subs = await Subject.find({ code: { $in: codes } }).lean();
console.log('SUBJECTS:', JSON.stringify(subs.map((s) => ({
  code: s.code,
  name: s.name,
  slotCount: s.slotCount,
  slotTimings: s.slotTimings,
})), null, 2));

const sample = await Schedule.find({ subjectCode: { $in: codes } }).limit(8).lean();
console.log('SAMPLE SCHEDULES:', JSON.stringify(sample.map((s) => ({
  trainerCode: s.trainerCode,
  day: s.day,
  slot: s.slot,
  startTime: s.startTime,
  endTime: s.endTime,
  subjectCode: s.subjectCode,
})), null, 2));

await mongoose.disconnect();
