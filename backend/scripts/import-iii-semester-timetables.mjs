import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { IDSA_SUBJECT, PEDH_SUBJECT } from '../utils/trainerMappings.js';
import {
  TRAINER_TIMETABLE_CODES,
  buildIIIsemesterSchedulePayloads,
} from '../utils/iiiSemesterTimetables.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const oldSchedules = await Schedule.find({
  trainerCode: { $in: TRAINER_TIMETABLE_CODES },
}).select('_id');
const oldScheduleIds = oldSchedules.map((schedule) => schedule._id);

if (oldScheduleIds.length) {
  await Leave.updateMany(
    { affectedSchedules: { $in: oldScheduleIds } },
    { $pull: { affectedSchedules: { $in: oldScheduleIds } } }
  );
  await Leave.updateMany(
    { 'replacements.schedule': { $in: oldScheduleIds } },
    { $pull: { replacements: { schedule: { $in: oldScheduleIds } } } }
  );
}

const deleted = await Schedule.deleteMany({
  trainerCode: { $in: TRAINER_TIMETABLE_CODES },
});

const subjects = await Subject.find({
  code: { $in: [IDSA_SUBJECT.code, PEDH_SUBJECT.code] },
}).select('code _id');
const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject._id]));

const payloads = buildIIIsemesterSchedulePayloads().map((entry) => ({
  ...entry,
  subject: subjectByCode.get(entry.subjectCode),
}));

const missingSubjects = payloads
  .filter((entry) => !entry.subject)
  .map((entry) => entry.subjectCode);
if (missingSubjects.length) {
  throw new Error(`Missing subject(s): ${[...new Set(missingSubjects)].join(', ')}`);
}

const created = await Schedule.insertMany(payloads);

const trainers = await Trainer.find({
  scheduleTrainerCodes: { $in: TRAINER_TIMETABLE_CODES },
}).select('name employeeId scheduleTrainerCodes');
const trainerByCode = new Map(
  trainers.flatMap((trainer) =>
    (trainer.scheduleTrainerCodes || []).map((code) => [code, trainer])
  )
);

console.log(`Removed ${deleted.deletedCount} old slot(s). Inserted ${created.length} slot(s).`);

for (const code of TRAINER_TIMETABLE_CODES) {
  const trainer = trainerByCode.get(code);
  const slots = created.filter((schedule) => schedule.trainerCode === code);
  console.log(`${trainer?.name || code} (${code}): ${slots.length} slot(s)`);
}

await mongoose.disconnect();
