import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const PSTJ_CODE = '22CA102006';
const PEDH_CODE = '22CS102037';
const DSAP_CODE = '25CA202009';
const SAI_EMPLOYEE_ID = '131886';
const LEGACY_PEDH_CODE = 'PEDH- T07';

const sai = await Trainer.findOne({
  $or: [{ employeeId: SAI_EMPLOYEE_ID }, { scheduleTrainerCodes: 'PSTJ1' }, { scheduleTrainerCodes: LEGACY_PEDH_CODE }],
});
if (!sai) throw new Error('Sai Priya trainer not found');

const [pstjSubject, pedhSubject, dsapSubject] = await Promise.all([
  Subject.findOne({ code: PSTJ_CODE }),
  Subject.findOne({ code: PEDH_CODE }),
  Subject.findOne({ code: DSAP_CODE }),
]);
if (!pstjSubject) throw new Error('PSTJ subject not found');

// 1) Delete orphan legacy PEDH- T07 slots (wrongly attributed to Sai via name match)
const removedLegacy = await Schedule.deleteMany({ trainerCode: LEGACY_PEDH_CODE });

// 2) Delete any schedules directly under her employeeId that are not BCA/PSTJ
const removedEmpId = await Schedule.deleteMany({
  trainerCode: SAI_EMPLOYEE_ID,
});

// 3) Ensure her legacy schedule code is PSTJ1 only (drop stale PEDH- T07 if present)
await Trainer.updateOne(
  { _id: sai._id },
  { $pull: { scheduleTrainerCodes: LEGACY_PEDH_CODE } }
);
await Trainer.updateOne(
  { _id: sai._id },
  { $addToSet: { scheduleTrainerCodes: 'PSTJ1' } }
);

// 4) Subjects: keep only PSTJ, drop PEDH + DSAP
if (pedhSubject) {
  await Trainer.updateOne({ _id: sai._id }, { $pull: { subjects: pedhSubject._id } });
  await Subject.updateOne({ _id: pedhSubject._id }, { $pull: { trainerEligible: sai._id } });
}
if (dsapSubject) {
  await Trainer.updateOne({ _id: sai._id }, { $pull: { subjects: dsapSubject._id } });
  await Subject.updateOne({ _id: dsapSubject._id }, { $pull: { trainerEligible: sai._id } });
}
await Trainer.updateOne({ _id: sai._id }, { $addToSet: { subjects: pstjSubject._id } });
await Subject.updateOne({ _id: pstjSubject._id }, { $addToSet: { trainerEligible: sai._id } });

// Report
const after = await Trainer.findById(sai._id).populate('subjects', 'code name');
const pstj1Schedules = await Schedule.find({ trainerCode: 'PSTJ1' }).sort({ day: 1, slot: 1 });

console.log(`Removed ${removedLegacy.deletedCount} legacy '${LEGACY_PEDH_CODE}' slot(s).`);
console.log(`Removed ${removedEmpId.deletedCount} slot(s) under employeeId ${SAI_EMPLOYEE_ID}.`);
console.log('Sai Priya after:', {
  name: after.name,
  employeeId: after.employeeId,
  codes: after.scheduleTrainerCodes,
  subjects: after.subjects.map((s) => `${s.code} ${s.name}`),
});
console.log('\nPSTJ1 (Sai Priya) schedules:');
pstj1Schedules.forEach((s) => console.log(`  ${s.day} ${s.slot} ${s.startTime}-${s.endTime} ${s.department} ${s.section} ${s.subjectCode}`));

await mongoose.disconnect();
