import Department from '../models/Department.js';
import School from '../models/School.js';
import Semester from '../models/Semester.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import User from '../models/User.js';
import Schedule from '../models/Schedule.js';
import {
  IDSA_TRAINER_NAMES,
  IDSA_SUBJECT,
  IDSA_DEPARTMENT_CODES,
} from './trainerMappings.js';
import { SOC_FOUR_SLOT_TIMINGS } from './subjectSlotTimings.js';

import { DEFAULT_SUBJECT_START_DATE } from './subjectStartDate.js';

const LEGACY_IDSA_CODE = 'IDSA';

const mergeTrainerIds = (...lists) => [
  ...new Set(
    lists
      .flat()
      .filter(Boolean)
      .map((id) => String(id))
  ),
];

export const syncIdsaTrainersAndSubject = async () => {
  await Department.findOneAndUpdate(
    { code: 'CS' },
    { name: 'Cyber Security' },
    { upsert: false }
  );

  const idsaTrainerCodes = Object.keys(IDSA_TRAINER_NAMES);
  const trainers = [];

  for (const [employeeId, name] of Object.entries(IDSA_TRAINER_NAMES)) {
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
  const departments = await Department.find({ code: { $in: IDSA_DEPARTMENT_CODES } });

  const legacySubject = await Subject.findOne({ code: LEGACY_IDSA_CODE });
  let subject = await Subject.findOne({ code: IDSA_SUBJECT.code });

  const subjectPayload = {
    name: IDSA_SUBJECT.name,
    code: IDSA_SUBJECT.code,
    schools: socSchool ? [socSchool._id] : [],
    departments: departments.map((d) => d._id),
    semester: semesterIII?._id,
    allDepartments: false,
    hours: 6,
    trainerEligible: mergeTrainerIds(
      subject?.trainerEligible,
      legacySubject?.trainerEligible,
      trainers.map((t) => t._id)
    ),
    slotTimings: SOC_FOUR_SLOT_TIMINGS,
    slotCount: 4,
  };

  if (subject) {
    const { hours, ...syncFields } = subjectPayload;
    Object.assign(subject, syncFields);
    await subject.save();
  } else if (socSchool && semesterIII && trainers.length) {
    subject = await Subject.create({
      ...subjectPayload,
      oifNumber: IDSA_SUBJECT.code,
      dealNumber: IDSA_SUBJECT.code,
      startDate: DEFAULT_SUBJECT_START_DATE,
    });
  }

  if (subject) {
    if (legacySubject) {
      await Trainer.updateMany(
        { subjects: legacySubject._id },
        { $pull: { subjects: legacySubject._id } }
      );
      await legacySubject.deleteOne();
    }

    await Trainer.updateMany(
      { employeeId: { $in: idsaTrainerCodes } },
      { $addToSet: { subjects: subject._id } }
    );

    await Schedule.updateMany(
      {
        $or: [
          { trainerCode: { $in: idsaTrainerCodes } },
          { subjectCode: LEGACY_IDSA_CODE },
        ],
      },
      { $set: { subjectCode: IDSA_SUBJECT.code, subject: subject._id } }
    );
  }

  const demoUser = await User.findOne({ email: 'trainer@toms.edu' });
  if (demoUser?.trainer) {
    const demoTrainer = await Trainer.findById(demoUser.trainer);
    if (demoTrainer && IDSA_TRAINER_NAMES[demoTrainer.employeeId]) {
      await User.updateOne(
        { _id: demoUser._id },
        { name: IDSA_TRAINER_NAMES[demoTrainer.employeeId] }
      );
    }
  }

  return {
    trainersUpdated: trainers.length,
    subjectCode: subject?.code || null,
    legacySubjectRemoved: Boolean(legacySubject),
    schedulesTagged: await Schedule.countDocuments({
      trainerCode: { $in: idsaTrainerCodes },
      subjectCode: IDSA_SUBJECT.code,
    }),
  };
};
