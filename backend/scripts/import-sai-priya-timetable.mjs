import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import { SAI_PRIYA_TRAINER_CODE } from '../utils/trainerMappings.js';
import { buildSaiPriyaSchedulePayloads } from '../utils/saiPriyaTimetable.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const deleted = await Schedule.deleteMany({ trainerCode: SAI_PRIYA_TRAINER_CODE });

const subjectByCode = new Map(
  (await Subject.find().select('code _id')).map((subject) => [subject.code, subject._id])
);

const payloads = buildSaiPriyaSchedulePayloads().map((entry) => ({
  ...entry,
  subject: subjectByCode.get(entry.subjectCode),
}));

const created = await Schedule.insertMany(payloads);

console.log(`Removed ${deleted.deletedCount} old slot(s). Inserted ${created.length} Sai Priya timetable slot(s).`);
created.forEach((slot) => {
  console.log(
    `${slot.day} ${slot.slot} ${slot.startTime}-${slot.endTime} ${slot.department} ${slot.section} (${slot.subjectCode})`
  );
});

await mongoose.disconnect();
