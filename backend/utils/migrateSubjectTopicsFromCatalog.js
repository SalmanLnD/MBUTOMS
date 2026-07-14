import Subject from '../models/Subject.js';
import { TOPIC_CATALOG_BY_SUBJECT_CODE } from './topicTrackerTopicCatalog.js';

/** Seed subject.topics from the static catalogs when the field is still empty. */
export const migrateSubjectTopicsFromCatalog = async () => {
  let updatedCount = 0;

  for (const [code, topics] of Object.entries(TOPIC_CATALOG_BY_SUBJECT_CODE)) {
    const normalized = topics.map((topic) => String(topic || '').trim()).filter(Boolean);
    if (!normalized.length) continue;

    const result = await Subject.updateOne(
      {
        code,
        $or: [
          { topics: { $exists: false } },
          { topics: null },
          { topics: { $size: 0 } },
        ],
      },
      { $set: { topics: normalized } }
    );
    updatedCount += result.modifiedCount || 0;
  }

  return { updatedCount };
};
