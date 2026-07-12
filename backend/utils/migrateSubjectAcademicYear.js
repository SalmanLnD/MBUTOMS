import Subject from '../models/Subject.js';

const DEFAULT_ACADEMIC_YEAR = '2026-27';

export const migrateSubjectAcademicYear = async () => {
  const result = await Subject.updateMany(
    {
      $or: [
        { academicYear: { $exists: false } },
        { academicYear: '' },
        { academicYear: null },
      ],
    },
    { $set: { academicYear: DEFAULT_ACADEMIC_YEAR } }
  );

  return { updatedCount: result.modifiedCount, academicYear: DEFAULT_ACADEMIC_YEAR };
};
