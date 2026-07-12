import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';
import { removeTrainerUser } from '../utils/trainerUserSync.js';

dotenv.config();

export const PEDH_SUBJECT_CODE = '22CS102037';

export const PEDH_SCHEDULE_CODES = [
  'PEDH- T01',
  'PEDH- T02',
  'PEDH- T03',
  'PEDH- T04',
  'PEDH- T05',
  'PEDH- T06',
  'PEDH- T07',
];

const PLACEHOLDER_PEDH_EMPLOYEE_PATTERN = /^PEDH-\s*T\d+$/i;

const isPlaceholderPedhTrainer = (trainer) =>
  PLACEHOLDER_PEDH_EMPLOYEE_PATTERN.test(String(trainer?.employeeId || '').trim());

const buildScheduleFilter = (pedhSubjectId) => {
  const clauses = [
    { trainerCode: { $regex: /^PEDH-\s*T\d+$/i } },
    { subjectCode: PEDH_SUBJECT_CODE },
    { 'replacementFor.trainerCode': { $regex: /^PEDH-\s*T\d+$/i } },
  ];

  if (pedhSubjectId) {
    clauses.push({ subject: pedhSubjectId });
  }

  return { $or: clauses };
};

const pullPedhScheduleCodes = async () => {
  let updated = 0;
  for (const code of PEDH_SCHEDULE_CODES) {
    const result = await Trainer.updateMany(
      { scheduleTrainerCodes: code },
      { $pull: { scheduleTrainerCodes: code } }
    );
    updated += result.modifiedCount;
  }
  return updated;
};

export const removeAllPedhData = async () => {
  const pedhSubject = await Subject.findOne({ code: PEDH_SUBJECT_CODE }).select('_id code name');
  const pedhSubjectId = pedhSubject?._id;

  const scheduleFilter = buildScheduleFilter(pedhSubjectId);
  const pedhSchedules = await Schedule.find(scheduleFilter).select('_id');
  const pedhScheduleIds = pedhSchedules.map((schedule) => schedule._id);

  const removedSchedules = await Schedule.deleteMany(scheduleFilter);

  if (pedhScheduleIds.length) {
    await Leave.updateMany(
      { affectedSchedules: { $in: pedhScheduleIds } },
      { $pull: { affectedSchedules: { $in: pedhScheduleIds } } }
    );
    await Leave.updateMany(
      { 'replacements.schedule': { $in: pedhScheduleIds } },
      { $pull: { replacements: { schedule: { $in: pedhScheduleIds } } } }
    );
    await Attendance.deleteMany({ schedule: { $in: pedhScheduleIds } });
  }

  let strippedTrainerLinks = 0;
  if (pedhSubjectId) {
    const trainerPull = await Trainer.updateMany(
      { subjects: pedhSubjectId },
      { $pull: { subjects: pedhSubjectId } }
    );
    strippedTrainerLinks += trainerPull.modifiedCount;
  }

  const strippedScheduleCodes = await pullPedhScheduleCodes();

  const placeholderTrainers = await Trainer.find({
    employeeId: { $regex: PLACEHOLDER_PEDH_EMPLOYEE_PATTERN },
  });

  let removedTrainers = 0;
  for (const trainer of placeholderTrainers) {
    if (!isPlaceholderPedhTrainer(trainer)) continue;

    await Leave.deleteMany({
      $or: [{ trainer: trainer._id }, { 'replacements.replacementTrainer': trainer._id }],
    });
    await Attendance.deleteMany({ trainer: trainer._id });
    await removeTrainerUser(trainer._id);
    await trainer.deleteOne();
    removedTrainers += 1;
    console.log(`Removed placeholder trainer ${trainer.name} (${trainer.employeeId})`);
  }

  let removedSubject = 0;
  if (pedhSubject) {
    const subjectDelete = await Subject.deleteOne({ _id: pedhSubject._id });
    removedSubject = subjectDelete.deletedCount;
    console.log(`Removed subject ${pedhSubject.code} (${pedhSubject.name})`);
  }

  return {
    removedSchedules: removedSchedules.deletedCount,
    strippedTrainerSubjectLinks: strippedTrainerLinks,
    strippedScheduleCodes,
    removedTrainers,
    removedSubject,
    pedhSubjectCode: PEDH_SUBJECT_CODE,
  };
};

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun || process.argv[1]?.includes('remove-all-pedh-data.mjs')) {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await removeAllPedhData();
  console.log('PEDH data cleanup:', result);
  await mongoose.disconnect();
}
