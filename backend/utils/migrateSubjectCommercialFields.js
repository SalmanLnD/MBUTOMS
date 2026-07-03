import Subject from '../models/Subject.js';
import { DEFAULT_SUBJECT_START_DATE } from './subjectStartDate.js';

/**
 * One-time migration: backfill OIF/deal numbers from subject code and set start date.
 * Only updates records missing these fields so new subjects keep user-entered values.
 */
export const migrateSubjectCommercialFields = async () => {
  const subjects = await Subject.find({
    $or: [
      { oifNumber: { $exists: false } },
      { oifNumber: '' },
      { dealNumber: { $exists: false } },
      { dealNumber: '' },
      { startDate: { $exists: false } },
      { startDate: null },
    ],
  }).select('code oifNumber dealNumber startDate');

  let updatedCount = 0;

  for (const subject of subjects) {
    const update = {};

    if (!subject.oifNumber?.trim()) {
      update.oifNumber = subject.code;
    }
    if (!subject.dealNumber?.trim()) {
      update.dealNumber = subject.code;
    }
    if (!subject.startDate) {
      update.startDate = DEFAULT_SUBJECT_START_DATE;
    }

    if (Object.keys(update).length) {
      await Subject.updateOne({ _id: subject._id }, { $set: update });
      updatedCount += 1;
    }
  }

  return { updatedCount, defaultStartDate: DEFAULT_SUBJECT_START_DATE.toISOString().slice(0, 10) };
};
