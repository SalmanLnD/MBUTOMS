import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { applyTrainerSubjectsChange } from './syncTrainerSubjectLinks.js';
import {
  LRRE_SUBJECT_CODE,
  LRRE_V_SEMESTER,
  LRRE_V_TRAINER_ALLOCATIONS,
  LRRE_V_TRAINER_EMPLOYEE_IDS,
  buildExpectedScheduleRecord,
} from './lrreVSemesterTimetable.js';

export const syncLrreVSemesterTimetable = async () => {
  const subject = await Subject.findOne({ code: LRRE_SUBJECT_CODE });
  if (!subject) {
    throw new Error(`LRRE subject ${LRRE_SUBJECT_CODE} not found`);
  }

  const trainers = await Trainer.find({ employeeId: { $in: LRRE_V_TRAINER_EMPLOYEE_IDS } }).select(
    '_id employeeId name subjects'
  );
  const trainersByEmployeeId = new Map(trainers.map((trainer) => [trainer.employeeId, trainer]));

  let upsertedCount = 0;
  let updatedCount = 0;

  for (const employeeId of LRRE_V_TRAINER_EMPLOYEE_IDS) {
    const allocation = LRRE_V_TRAINER_ALLOCATIONS[employeeId];
    if (!allocation?.slots?.length) continue;

    await Schedule.deleteMany({
      trainerCode: employeeId,
      semester: LRRE_V_SEMESTER,
      subjectCode: LRRE_SUBJECT_CODE,
    });

    for (const entry of allocation.slots) {
      const record = buildExpectedScheduleRecord(employeeId, entry, subject._id);
      const existing = await Schedule.findOne({
        trainerCode: employeeId,
        semester: LRRE_V_SEMESTER,
        subjectCode: LRRE_SUBJECT_CODE,
        day: record.day,
        slot: record.slot,
      }).select('_id');

      await Schedule.findOneAndUpdate(
        {
          trainerCode: employeeId,
          semester: LRRE_V_SEMESTER,
          subjectCode: LRRE_SUBJECT_CODE,
          day: record.day,
          slot: record.slot,
        },
        { $set: record },
        { upsert: true, setDefaultsOnInsert: true }
      );

      if (existing) updatedCount += 1;
      else upsertedCount += 1;
    }

    const trainer = trainersByEmployeeId.get(employeeId);
    if (trainer) {
      const previousSubjects = [...(trainer.subjects || [])];
      const nextSubjects = [...new Set([...previousSubjects.map(String), subject._id.toString()])];
      if (nextSubjects.length !== previousSubjects.length) {
        await applyTrainerSubjectsChange(trainer._id, previousSubjects, nextSubjects);
      }
    }
  }

  return {
    subjectCode: LRRE_SUBJECT_CODE,
    semester: LRRE_V_SEMESTER,
    upsertedCount,
    updatedCount,
    trainerCount: LRRE_V_TRAINER_EMPLOYEE_IDS.length,
  };
};
