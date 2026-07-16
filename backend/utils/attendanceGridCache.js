const cache = new Map();
// Leave/punch/replacement writes invalidate explicitly, so a longer TTL is safe.
const CACHE_TTL_MS = 150_000;

export const buildAttendanceGridCacheKey = (month, semester, user) => {
  const scope =
    user?.role === 'trainer' && user?.trainer
      ? user.trainer.toString()
      : 'all';
  return `${month}|${semester}|${scope}`;
};

export const getCachedAttendanceGrid = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

export const setCachedAttendanceGrid = (key, data) => {
  cache.set(key, { data, cachedAt: Date.now() });
};

export const clearAttendanceGridCache = () => {
  cache.clear();
};
