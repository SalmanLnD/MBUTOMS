import Trainer from '../models/Trainer.js';
import { mergeRosterFilter } from './rosterFilter.js';
import { mergeUiTrainerFilter } from './trainerEmployment.js';

// Initialize existing records once. Later archive/unarchive choices are preserved.
export const migrateTrainerDirectoryStatus = async () => {
  await Trainer.updateMany({ status: 'active', directoryReactivatedAt: { $ne: null }, employmentStatus: { $in: ['resigned', 'relocated'] } }, {
    $set: { employmentStatus: 'active', resignationDate: null, includeInAttendanceUntilMonth: '', showInRoster: true },
  });
  const missing = { directoryStatusInitializedAt: { $exists: false } };
  if (!await Trainer.exists(missing)) return;
  const visibleFilter = await mergeUiTrainerFilter(await mergeRosterFilter({}, { rosterOnly: false }));
  const current = await Trainer.find(visibleFilter).select('_id').lean();
  const activeIds = current.map(trainer => trainer._id);
  const now = new Date();
  await Trainer.updateMany({ ...missing, _id: { $in: activeIds } }, {
    $set: { status: 'active', directoryStatusInitializedAt: now },
  });
  await Trainer.updateMany(missing, { $set: { status: 'archived', directoryStatusInitializedAt: now } });
};
