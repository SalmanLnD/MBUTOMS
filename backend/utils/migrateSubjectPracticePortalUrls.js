import Subject from '../models/Subject.js';

/** Known practice portal links; fill only when the subject field is still empty. */
export const DEFAULT_PRACTICE_PORTAL_URLS = {
  '22CS102033': 'https://www.hackerrank.com/22cs102033s', // IDSA
  '25CA202009': 'https://www.hackerrank.com/25ca202009s', // DSAP
};

export const migrateSubjectPracticePortalUrls = async () => {
  let updatedCount = 0;

  for (const [code, url] of Object.entries(DEFAULT_PRACTICE_PORTAL_URLS)) {
    const result = await Subject.updateOne(
      {
        code,
        $or: [
          { practicePortalUrl: { $exists: false } },
          { practicePortalUrl: null },
          { practicePortalUrl: '' },
        ],
      },
      { $set: { practicePortalUrl: url } }
    );
    updatedCount += result.modifiedCount || 0;
  }

  return { updatedCount };
};
