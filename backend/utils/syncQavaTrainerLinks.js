import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { QAVA_SUBJECT_CODE, QAVA_TRAINER_EMPLOYEE_IDS } from './qavaTimetable.js';

/** Keep Suryadeo and Bhargavi linked to QAVA so coordinator/observation scope includes them. */
export const syncQavaTrainerLinks = async () => {
  const subject = await Subject.findOne({ code: QAVA_SUBJECT_CODE }).select('_id code trainerEligible');
  if (!subject) {
    return { updated: 0, linked: 0, status: 'skipped', reason: `Subject ${QAVA_SUBJECT_CODE} not found` };
  }

  const trainers = await Trainer.find({ employeeId: { $in: QAVA_TRAINER_EMPLOYEE_IDS } })
    .select('_id employeeId name subjects');

  if (!trainers.length) {
    return { updated: 0, linked: 0, status: 'skipped', reason: 'QAVA trainers not found' };
  }

  const trainerIds = trainers.map((trainer) => trainer._id);
  const eligible = new Set((subject.trainerEligible || []).map((id) => id.toString()));
  const missingEligible = trainerIds.filter((id) => !eligible.has(id.toString()));

  let updated = 0;
  if (missingEligible.length) {
    subject.trainerEligible = [...(subject.trainerEligible || []), ...missingEligible];
    await subject.save();
    updated += 1;
  }

  const trainerResult = await Trainer.updateMany(
    {
      _id: { $in: trainerIds },
      subjects: { $ne: subject._id },
    },
    { $addToSet: { subjects: subject._id } }
  );

  return {
    updated: updated + (trainerResult.modifiedCount || 0),
    linked: trainers.length,
    trainerEmployeeIds: trainers.map((trainer) => trainer.employeeId),
    status: updated || trainerResult.modifiedCount ? 'updated' : 'unchanged',
  };
};
