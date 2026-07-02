import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';

const toIdStrings = (ids) =>
  [...new Set((ids || []).map((id) => id?.toString?.() || String(id)).filter(Boolean))];

export const applySubjectTrainerEligibleChange = async (subjectId, previousIds, nextIds) => {
  const previous = new Set(toIdStrings(previousIds));
  const next = new Set(toIdStrings(nextIds));

  const added = [...next].filter((id) => !previous.has(id));
  const removed = [...previous].filter((id) => !next.has(id));

  if (added.length) {
    await Trainer.updateMany(
      { _id: { $in: added } },
      { $addToSet: { subjects: subjectId } }
    );
  }

  if (removed.length) {
    await Trainer.updateMany(
      { _id: { $in: removed } },
      { $pull: { subjects: subjectId } }
    );
  }

  return { added: added.length, removed: removed.length };
};

export const applyTrainerSubjectsChange = async (trainerId, previousIds, nextIds) => {
  const previous = new Set(toIdStrings(previousIds));
  const next = new Set(toIdStrings(nextIds));

  const added = [...next].filter((id) => !previous.has(id));
  const removed = [...previous].filter((id) => !next.has(id));

  if (added.length) {
    await Subject.updateMany(
      { _id: { $in: added } },
      { $addToSet: { trainerEligible: trainerId } }
    );
  }

  if (removed.length) {
    await Subject.updateMany(
      { _id: { $in: removed } },
      { $pull: { trainerEligible: trainerId } }
    );
  }

  return { added: added.length, removed: removed.length };
};

export const syncAllTrainerSubjectLinks = async () => {
  const subjects = await Subject.find().select('trainerEligible');
  let trainersUpdated = 0;

  for (const subject of subjects) {
    const trainerIds = toIdStrings(subject.trainerEligible);
    if (!trainerIds.length) continue;

    const result = await Trainer.updateMany(
      { _id: { $in: trainerIds } },
      { $addToSet: { subjects: subject._id } }
    );
    trainersUpdated += result.modifiedCount;
  }

  const trainers = await Trainer.find().select('subjects');
  let subjectsUpdated = 0;

  for (const trainer of trainers) {
    const subjectIds = toIdStrings(trainer.subjects);
    if (!subjectIds.length) continue;

    const result = await Subject.updateMany(
      { _id: { $in: subjectIds } },
      { $addToSet: { trainerEligible: trainer._id } }
    );
    subjectsUpdated += result.modifiedCount;
  }

  return { trainersUpdated, subjectsUpdated };
};
