import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import User from '../models/User.js';
import {
  PEDH_SUBJECT,
  PSTP_SUBJECT,
  findTrainerByScheduleCode,
} from '../utils/trainerMappings.js';
import {
  PEDH_ARCHIVED_TRAINER_CODES,
  PEDH_SLOTLESS_TRAINER_CODES,
} from '../utils/pedhTimetableArchive.js';
import { PSTP_T9_TRAINER_CODE } from '../utils/pstpTimetable.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const pedhSubject = await Subject.findOne({ code: PEDH_SUBJECT.code });
const pstpSubject = await Subject.findOne({ code: PSTP_SUBJECT.code });

const removedPedh = await Schedule.deleteMany({
  trainerCode: { $in: PEDH_ARCHIVED_TRAINER_CODES },
});
console.log(`Removed ${removedPedh.deletedCount} PEDH schedule slot(s).`);

for (const code of PEDH_SLOTLESS_TRAINER_CODES) {
  const trainer = await findTrainerByScheduleCode(Trainer, code);
  if (!trainer) {
    console.warn(`Slotless trainer not found for ${code}`);
    continue;
  }
  if (pedhSubject) {
    await Trainer.updateOne({ _id: trainer._id }, { $pull: { subjects: pedhSubject._id } });
    await Subject.updateOne({ _id: pedhSubject._id }, { $pull: { trainerEligible: trainer._id } });
  }
  const remaining = await Schedule.countDocuments({ trainerCode: code });
  console.log(`${trainer.name} (${code}): slotless, ${remaining} remaining slot(s)`);
}

const mahendra =
  (await Trainer.findOne({ name: /mahendra urumu/i }))
  || (await findTrainerByScheduleCode(Trainer, 'PEDH- T03'));
const placeholder = await Trainer.findOne({ employeeId: PSTP_T9_TRAINER_CODE });

if (mahendra && pstpSubject) {
  const camuFields = {};
  if (placeholder?.camuErpId && !mahendra.camuErpId) camuFields.camuErpId = placeholder.camuErpId;
  if (placeholder?.camuPassword && !mahendra.camuPassword) camuFields.camuPassword = placeholder.camuPassword;

  await Trainer.updateOne(
    { _id: mahendra._id },
    { $pull: { scheduleTrainerCodes: 'PEDH- T03', subjects: pedhSubject?._id } }
  );
  await Trainer.updateOne(
    { _id: mahendra._id },
    {
      $addToSet: { scheduleTrainerCodes: PSTP_T9_TRAINER_CODE, subjects: pstpSubject._id },
      ...(Object.keys(camuFields).length ? { $set: camuFields } : {}),
    }
  );
  if (placeholder?._id) {
    await Subject.updateOne(
      { _id: pstpSubject._id },
      { $pull: { trainerEligible: placeholder._id } }
    );
  }
  await Subject.updateOne(
    { _id: pstpSubject._id },
    { $addToSet: { trainerEligible: mahendra._id } }
  );
  if (pedhSubject) {
    await Subject.updateOne(
      { _id: pedhSubject._id },
      { $pull: { trainerEligible: mahendra._id } }
    );
  }

  const pstpSlots = await Schedule.countDocuments({ trainerCode: PSTP_T9_TRAINER_CODE });
  console.log(`Mahendra Urumu linked to ${PSTP_T9_TRAINER_CODE}: ${pstpSlots} PSTP slot(s).`);
}

if (placeholder) {
  const placeholderUser = await User.findOne({ trainer: placeholder._id });
  if (placeholderUser) {
    await User.deleteOne({ _id: placeholderUser._id });
    console.log('Removed placeholder PSTP-T9 user account.');
  }
  await Trainer.deleteOne({ _id: placeholder._id });
  console.log('Removed placeholder PSTP-T9 trainer record.');
}

const pedhT06 = await findTrainerByScheduleCode(Trainer, 'PEDH- T06');
if (pedhT06 && pedhSubject) {
  await Trainer.updateOne({ _id: pedhT06._id }, { $pull: { subjects: pedhSubject._id } });
  console.log('PEDH T06: PEDH subject removed.');
}

await mongoose.disconnect();
