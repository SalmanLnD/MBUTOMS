import { isTrainerLikeRole } from './roles.js';
import { getDataRevision } from './dataRevision.js';

const cache = new Map();
// Leave/punch/replacement writes invalidate explicitly, so a longer TTL is safe.
const CACHE_TTL_MS = 150_000;

export const buildAttendanceGridCacheKey = (month, semester, user, todayKey = '') => {
  const trainerIdentity = user?.trainer?._id || user?.trainer || user?._id;
  const scope = isTrainerLikeRole(user?.role)
    ? `trainer:${trainerIdentity ? trainerIdentity.toString() : 'unlinked'}`
    : 'all';
  return `${month}|${semester}|${scope}|${todayKey}`;
};

export const getCachedAttendanceGrid = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (
    entry.revision !== getDataRevision()
    || Date.now() - entry.cachedAt > CACHE_TTL_MS
  ) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

export const setCachedAttendanceGrid = (key, data) => {
  cache.set(key, { data, cachedAt: Date.now(), revision: getDataRevision() });
};

export const clearAttendanceGridCache = () => {
  cache.clear();
};
