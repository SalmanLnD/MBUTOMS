import User from '../models/User.js';
import Trainer from '../models/Trainer.js';
import { ADMIN_TRAINER_EMPLOYEE_ID } from './trainerMappings.js';
import { excludeArchivedExternalTrainers } from './externalTrainerArchive.js';
import { ROSTER_HIDDEN_STAFF_ROLES } from './roles.js';

const isTruthyQuery = (value) => value === true || value === 'true' || value === '1';

export const shouldApplyRosterFilter = (query = {}, { defaultRosterOnly = false } = {}) => {
  if (isTruthyQuery(query.rosterOnly)) return true;
  if (query.rosterOnly === 'false' || query.rosterOnly === '0') return false;
  return defaultRosterOnly;
};

export const getHiddenRosterTrainerIds = async ({ attendance = false } = {}) => {
  const staffUsers = await User.find({
    role: { $in: ROSTER_HIDDEN_STAFF_ROLES },
    trainer: { $exists: true, $ne: null },
  })
    .select('trainer')
    .lean();

  const ids = staffUsers.map((user) => user.trainer.toString());
  if (!attendance) return ids;
  // The admin's personal trainer record still participates in attendance.
  const personalTrainer = await Trainer.findOne({ employeeId: ADMIN_TRAINER_EMPLOYEE_ID }).select('_id').lean();
  return ids.filter(id => id !== personalTrainer?._id.toString());
};

export const mergeRosterFilter = async (baseFilter = {}, { rosterOnly = true, attendance = false } = {}) => {
  if (!rosterOnly) return excludeArchivedExternalTrainers(baseFilter);

  const hiddenTrainerIds = await getHiddenRosterTrainerIds({ attendance });
  const rosterClause = {
    showInRoster: { $ne: false },
    ...(hiddenTrainerIds.length ? { _id: { $nin: hiddenTrainerIds } } : {}),
  };

  if (!Object.keys(baseFilter).length) return excludeArchivedExternalTrainers(rosterClause);
  return excludeArchivedExternalTrainers({ $and: [baseFilter, rosterClause] });
};
