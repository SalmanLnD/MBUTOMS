import User from '../models/User.js';
import { ROSTER_HIDDEN_STAFF_ROLES } from './roles.js';

const isTruthyQuery = (value) => value === true || value === 'true' || value === '1';

export const shouldApplyRosterFilter = (query = {}, { defaultRosterOnly = false } = {}) => {
  if (isTruthyQuery(query.rosterOnly)) return true;
  if (query.rosterOnly === 'false' || query.rosterOnly === '0') return false;
  return defaultRosterOnly;
};

export const getHiddenRosterTrainerIds = async () => {
  const staffUsers = await User.find({
    role: { $in: ROSTER_HIDDEN_STAFF_ROLES },
    trainer: { $exists: true, $ne: null },
  })
    .select('trainer')
    .lean();

  return staffUsers.map((user) => user.trainer.toString());
};

export const mergeRosterFilter = async (baseFilter = {}, { rosterOnly = true } = {}) => {
  if (!rosterOnly) return baseFilter;

  const hiddenTrainerIds = await getHiddenRosterTrainerIds();
  const rosterClause = {
    showInRoster: { $ne: false },
    ...(hiddenTrainerIds.length ? { _id: { $nin: hiddenTrainerIds } } : {}),
  };

  if (!Object.keys(baseFilter).length) return rosterClause;
  return { $and: [baseFilter, rosterClause] };
};
