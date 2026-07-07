import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { NAVYA_TRAINER_CODE } from '../utils/navyaTimetable.js';
import { buildNavyaSchedulePayloads } from '../utils/navyaTimetable.js';
import { IDSA_SUBJECT } from '../utils/trainerMappings.js';
import { PSTJ_SUBJECT_CODE } from '../utils/subjectSlotTimings.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const navya = await Trainer.findOne({
  $or: [
    { employeeId: 'IDSA-T2' },
    { employeeId: '135301' },
    { scheduleTrainerCodes: NAVYA_TRAINER_CODE },
  ],
});
if (!navya) {
  throw new Error('Navya trainer record not found');
}

const idsaSubject = await Subject.findOne({ code: IDSA_SUBJECT.code });
const pstjSubject = await Subject.findOne({ code: PSTJ_SUBJECT_CODE });
if (!idsaSubject || !pstjSubject) {
  throw new Error('IDSA or PSTJ subject not found');
}

await Trainer.updateOne(
  { _id: navya._id },
  { $addToSet: { subjects: { $each: [idsaSubject._id, pstjSubject._id] } } }
);
await Subject.updateOne(
  { _id: pstjSubject._id },
  { $addToSet: { trainerEligible: navya._id } }
);

const deleted = await Schedule.deleteMany({ trainerCode: NAVYA_TRAINER_CODE });

const subjectByCode = new Map([
  [idsaSubject.code, idsaSubject._id],
  [pstjSubject.code, pstjSubject._id],
]);

const payloads = buildNavyaSchedulePayloads().map((entry) => ({
  ...entry,
  subject: subjectByCode.get(entry.subjectCode),
}));

const created = await Schedule.insertMany(payloads);

console.log(`Navya (${navya.name}, ${navya.employeeId})`);
console.log(`Removed ${deleted.deletedCount} old slot(s). Inserted ${created.length} timetable slot(s).`);
created.forEach((slot) => {
  console.log(
    `${slot.day} ${slot.slot} ${slot.startTime}-${slot.endTime} ${slot.department} ${slot.section} (${slot.subjectCode})`
  );
});

await mongoose.disconnect();
