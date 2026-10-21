import Subject from '../models/Subject.js';
import { defaultSubjectEndDate } from './subjectTrainingDates.js';
import { clearSubjectStartDateCache } from './subjectStartDate.js';

export const migrateSubjectEndDates = async () => {
  const missing = { $or: [{ endDate: { $exists: false } }, { endDate: null }] };
  const subjects = await Subject.find(missing).select('_id code name').lean();
  if (!subjects.length) return;
  await Subject.bulkWrite(subjects.map(subject => ({ updateOne: {
    filter: { _id: subject._id, ...missing }, update: { $set: { endDate: defaultSubjectEndDate(subject) } },
  } })));
  clearSubjectStartDateCache();
};
