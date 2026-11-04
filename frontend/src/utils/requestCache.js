/** Bounded read-through cache: share in-flight reads, never resurrect invalidated data. */
export const createRequestCache = ({ ttlMs = 60_000, maxEntries = 12, clock = Date.now } = {}) => {
  const records = new Map();
  const trim = () => {
    while (records.size > maxEntries) records.delete(records.keys().next().value);
  };
  return {
    clear() { records.clear(); },
    set(key, data) {
      records.delete(key);
      records.set(key, { data, expires: clock() + ttlMs });
      trim();
    },
    get(key, fetcher, { force = false } = {}) {
      const cached = records.get(key);
      if (cached?.pending) return cached.pending;
      if (!force && cached && cached.expires > clock()) return Promise.resolve(cached.data);
      const record = {};
      records.delete(key);
      records.set(key, record);
      trim();
      record.pending = Promise.resolve().then(fetcher).then(data => {
        if (records.get(key) === record) {
          record.data = data;
          record.expires = clock() + ttlMs;
          delete record.pending;
        }
        return data;
      }, error => {
        if (records.get(key) === record) records.delete(key);
        throw error;
      });
      return record.pending;
    },
  };
};
