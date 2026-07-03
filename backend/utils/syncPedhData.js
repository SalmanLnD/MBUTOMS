import Department from '../models/Department.js';
import School from '../models/School.js';
import Semester from '../models/Semester.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import User from '../models/User.js';
import Schedule from '../models/Schedule.js';
import {
  PEDH_TRAINER_NAMES,
  PEDH_SUBJECT,
  PEDH_DEPARTMENT_CODES,
  SAI_PRIYA_TRAINER_CODE,
  DSAP_SUBJECT,
  resolveSaiPriyaSubjectCode,
} from './trainerMappings.js';
import { DEFAULT_SLOT_TIMINGS } from './timetableSlots.js';

import { DEFAULT_SUBJECT_START_DATE } from './subjectStartDate.js';

export const syncSaiPriyaScheduleSubjects = async () => {
  const trainer = await Trainer.findOne({ employeeId: SAI_PRIYA_TRAINER_CODE });
  if (!trainer) {
    return { updated: 0, pedhSlots: 0, dsapSlots: 0 };
  }

  const pedhSubject = await Subject.findOne({ code: PEDH_SUBJECT.code });
  const dsapSubject = await Subject.findOne({ code: DSAP_SUBJECT.code });
  const schedules = await Schedule.find({ trainerCode: SAI_PRIYA_TRAINER_CODE });

  let updated = 0;
  for (const schedule of schedules) {
    const subjectCode = resolveSaiPriyaSubjectCode(schedule);
    if (!subjectCode) continue;

    const subjectDoc = subjectCode === DSAP_SUBJECT.code ? dsapSubject : pedhSubject;
    if (!subjectDoc) continue;

    schedule.subjectCode = subjectCode;
    schedule.subject = subjectDoc._id;
    await schedule.save();
    updated += 1;
  }

  if (pedhSubject) {
    await Trainer.updateOne(
      { _id: trainer._id },
      { $addToSet: { subjects: pedhSubject._id } }
    );
  }
  if (dsapSubject) {
    await Trainer.updateOne(
      { _id: trainer._id },
      { $addToSet: { subjects: dsapSubject._id } }
    );
    await Subject.updateOne(
      { _id: dsapSubject._id },
      { $addToSet: { trainerEligible: trainer._id } }
    );
  }

  const [pedhSlots, dsapSlots] = await Promise.all([
    Schedule.countDocuments({
      trainerCode: SAI_PRIYA_TRAINER_CODE,
      subjectCode: PEDH_SUBJECT.code,
    }),
    Schedule.countDocuments({
      trainerCode: SAI_PRIYA_TRAINER_CODE,
      subjectCode: DSAP_SUBJECT.code,
    }),
  ]);

  return { updated, pedhSlots, dsapSlots };
};

export const syncPedhTrainersAndSubject = async () => {
  const pedhTrainerCodes = Object.keys(PEDH_TRAINER_NAMES);
  const pedhScheduleTrainerCodes = pedhTrainerCodes.filter(
    (code) => code !== SAI_PRIYA_TRAINER_CODE
  );
  const trainers = [];

  for (const [employeeId, name] of Object.entries(PEDH_TRAINER_NAMES)) {
    const trainer = await Trainer.findOneAndUpdate(
      { employeeId },
      { name },
      { new: true }
    );
    if (trainer) {
      trainers.push(trainer);
      await User.updateOne({ trainer: trainer._id }, { name });
    }
  }

  const socSchool = await School.findOne({ code: 'SOC' });
  const semesterIII = await Semester.findOne({ number: 3 });
  const departments = await Department.find({ code: { $in: PEDH_DEPARTMENT_CODES } });

  let subject = await Subject.findOne({ code: PEDH_SUBJECT.code });
  const subjectPayload = {
    name: PEDH_SUBJECT.name,
    code: PEDH_SUBJECT.code,
    schools: socSchool ? [socSchool._id] : [],
    departments: departments.map((d) => d._id),
    semester: semesterIII?._id,
    allDepartments: true,
    hours: 6,
    trainerEligible: trainers.map((t) => t._id),
    slotTimings: DEFAULT_SLOT_TIMINGS,
  };

  if (subject) {
    const mergedTrainerIds = [
      ...new Set([
        ...(subject.trainerEligible || []).map((id) => String(id)),
        ...trainers.map((t) => String(t._id)),
      ]),
    ];
    Object.assign(subject, {
      ...subjectPayload,
      trainerEligible: mergedTrainerIds,
    });
    await subject.save();
  } else if (socSchool && semesterIII && trainers.length) {
    subject = await Subject.create({
      ...subjectPayload,
      oifNumber: PEDH_SUBJECT.code,
      dealNumber: PEDH_SUBJECT.code,
      startDate: DEFAULT_SUBJECT_START_DATE,
    });
  }

  if (subject) {
    await Trainer.updateMany(
      { employeeId: { $in: pedhTrainerCodes } },
      { $addToSet: { subjects: subject._id } }
    );

    await Schedule.updateMany(
      { trainerCode: { $in: pedhScheduleTrainerCodes } },
      { $set: { subjectCode: PEDH_SUBJECT.code, subject: subject._id } }
    );
  }

  const saiPriyaSync = await syncSaiPriyaScheduleSubjects();

  return {
    trainersUpdated: trainers.length,
    subjectCode: subject?.code || null,
    schedulesTagged: await Schedule.countDocuments({
      trainerCode: { $in: pedhScheduleTrainerCodes },
      subjectCode: PEDH_SUBJECT.code,
    }),
    saiPriya: saiPriyaSync,
  };
};
