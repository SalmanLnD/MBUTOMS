import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { buildQavaSchedulePayloads, QAVA_TRAINER_EMPLOYEE_ID } from '../utils/qavaTimetable.js';
import { LRRE_V_TRAINER_EMPLOYEE_IDS } from '../utils/lrreVSemesterTimetable.js';
import { syncLrreVSemesterTimetable } from '../utils/syncLrreVSemesterTimetable.js';
import { QAVA_SUBJECT_CODE } from '../utils/subjectSlotTimings.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const trainerCodes = [...LRRE_V_TRAINER_EMPLOYEE_IDS, QAVA_TRAINER_EMPLOYEE_ID];

const oldSchedules = await Schedule.find({ trainerCode: { $in: trainerCodes } }).select('_id');
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

const deleted = await Schedule.deleteMany({ trainerCode: { $in: trainerCodes } });

const lrreSync = await syncLrreVSemesterTimetable();

const qavaSubject = await Subject.findOne({ code: QAVA_SUBJECT_CODE });
if (!qavaSubject) {
  throw new Error(`QAVA subject ${QAVA_SUBJECT_CODE} not found`);
}

const qavaPayloads = buildQavaSchedulePayloads().map((entry) => ({
  ...entry,
  subject: qavaSubject._id,
}));
const qavaCreated = await Schedule.insertMany(qavaPayloads);

const surya = await Trainer.findOne({ employeeId: QAVA_TRAINER_EMPLOYEE_ID });
if (surya) {
  await Trainer.updateOne(
    { _id: surya._id },
    { $addToSet: { subjects: qavaSubject._id } }
  );
  await Subject.updateOne(
    { _id: qavaSubject._id },
    { $addToSet: { trainerEligible: surya._id } }
  );
}

console.log(`Removed ${deleted.deletedCount} old slot(s).`);
console.log('LRRE sync:', lrreSync);
console.log(`QAVA slots inserted: ${qavaCreated.length}`);

for (const employeeId of trainerCodes) {
  const count = await Schedule.countDocuments({ trainerCode: employeeId });
  const trainer = await Trainer.findOne({ employeeId }).select('name');
  console.log(`${trainer?.name || employeeId} (${employeeId}): ${count} slot(s)`);
}

await mongoose.disconnect();
