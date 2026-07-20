import Subject from '../models/Subject.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { clearAttendanceGridCache } from './attendanceGridCache.js';
import { SUBJECT_OIF_CATALOG } from './subjectOifCatalog.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Sets commercial CT OIF numbers on known subjects and remaps attendance cells
 * that still store short forms (IDSA/PSTP/…) or university subject codes.
 */
export const migrateSubjectOifNumbers = async () => {
  let subjectsUpdated = 0;
  let attendanceUpdated = 0;

  for (const entry of SUBJECT_OIF_CATALOG) {
    const subject = await Subject.findOne({ code: entry.code }).select('name oifNumber');
    if (!subject) continue;

    const update = {};
    if (String(subject.oifNumber || '').trim() !== entry.oifNumber) {
      update.oifNumber = entry.oifNumber;
    }
    if (entry.name && String(subject.name || '').trim() !== entry.name) {
      update.name = entry.name;
    }

    if (Object.keys(update).length) {
      await Subject.updateOne({ _id: subject._id }, { $set: update });
      subjectsUpdated += 1;
    }

    const aliases = [...new Set(
      (entry.aliases || [])
        .map((alias) => String(alias || '').trim())
        .filter((alias) => alias && alias.toUpperCase() !== entry.oifNumber.toUpperCase())
    )];

    for (const alias of aliases) {
      const result = await TrainerDailyAttendance.updateMany(
        { oifNumber: { $regex: `^${escapeRegex(alias)}$`, $options: 'i' } },
        { $set: { oifNumber: entry.oifNumber } }
      );
      attendanceUpdated += result.modifiedCount || 0;
    }
  }

  if (subjectsUpdated || attendanceUpdated) {
    clearAttendanceGridCache();
  }

  return { subjectsUpdated, attendanceUpdated };
};
