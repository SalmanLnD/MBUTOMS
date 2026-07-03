import Department from '../models/Department.js';
import School from '../models/School.js';
import Semester from '../models/Semester.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import User from '../models/User.js';
import Schedule from '../models/Schedule.js';
import {
  PSTP_TRAINER_NAMES,
  PSTP_SUBJECT,
  PSTP_DEPARTMENT_CODES,
} from './trainerMappings.js';
import { DEFAULT_SLOT_TIMINGS } from './timetableSlots.js';
import { DEFAULT_SUBJECT_START_DATE } from './subjectStartDate.js';

export const syncPstpTrainersAndSubject = async () => {
  const pstpTrainerCodes = Object.keys(PSTP_TRAINER_NAMES);
  const trainers = [];

  for (const [employeeId, name] of Object.entries(PSTP_TRAINER_NAMES)) {
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
  const soeSchool = await School.findOne({ code: 'SOE' });
  const semesterIII = await Semester.findOne({ number: 3 });
  const departments = await Department.find({ code: { $in: PSTP_DEPARTMENT_CODES } });

  let subject = await Subject.findOne({ code: PSTP_SUBJECT.code });
  const subjectPayload = {
    name: PSTP_SUBJECT.name,
    code: PSTP_SUBJECT.code,
    schools: [socSchool?._id, soeSchool?._id].filter(Boolean),
    departments: departments.map((d) => d._id),
    semester: semesterIII?._id,
    allDepartments: false,
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
  } else if (semesterIII && trainers.length) {
    subject = await Subject.create({
      ...subjectPayload,
      oifNumber: PSTP_SUBJECT.code,
      dealNumber: PSTP_SUBJECT.code,
      startDate: DEFAULT_SUBJECT_START_DATE,
    });
  }

  if (subject) {
    await Trainer.updateMany(
      { employeeId: { $in: pstpTrainerCodes } },
      { $addToSet: { subjects: subject._id } }
    );

    await Schedule.updateMany(
      { trainerCode: { $in: pstpTrainerCodes } },
      { $set: { subjectCode: PSTP_SUBJECT.code, subject: subject._id } }
    );
  }

  return {
    trainersUpdated: trainers.length,
    subjectCode: subject?.code || null,
    schedulesTagged: await Schedule.countDocuments({
      trainerCode: { $in: pstpTrainerCodes },
      subjectCode: PSTP_SUBJECT.code,
    }),
  };
};
