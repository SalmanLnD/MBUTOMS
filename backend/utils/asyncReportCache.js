import { getDataRevision } from './dataRevision.js';

// Deduplicate simultaneous reads; bound retained reports and never cache failures.
export const createAsyncReportCache = ({ ttlMs = 30_000, maxEntries = 8 } = {}) => {
  const entries = new Map();
  return async (key, load) => {
    const revision = getDataRevision();
    const existing = entries.get(key);
    if (existing?.revision === revision && (existing.pending || existing.expires > Date.now())) {
      return existing.promise;
    }
    const entry = { revision, pending: true, expires: 0 };
    entry.promise = Promise.resolve().then(load).then((value) => {
      entry.pending = false;
      entry.expires = Date.now() + ttlMs;
      return value;
    }, (error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    return entry.promise;
  };
};
