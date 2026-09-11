import { getDataRevision } from '../utils/dataRevision.js';

const cache = new Map();
let active = false;
const TTL = 5 * 60_000;
const MAX_BYTES = 12 * 1024 * 1024;
let retainedBytes = 0;

// Called only AFTER export-key authentication. Serialize expensive Sheets work
// across endpoints so simultaneous triggers cannot multiply peak DB/CPU load.
export const exportGuard = (req, res, next) => {
  const query = Object.fromEntries(Object.entries(req.query || {}).filter(([key]) => key !== 'key').sort());
  const key = `${req.baseUrl}${req.path}|${JSON.stringify(query)}`;
  const revision = getDataRevision();
  for (const [storedKey, entry] of cache) {
    if (entry.expires <= Date.now() || entry.revision !== revision) {
      retainedBytes -= entry.bytes;
      cache.delete(storedKey);
    }
  }
  const hit = cache.get(key);
  res.setHeader('Cache-Control', 'no-store');
  if (hit) return res.json(hit.body);
  if (active) {
    res.setHeader('Retry-After', '30');
    return res.status(429).json({ message: 'Another report is being prepared. Retry in 30 seconds.' });
  }
  active = true;
  let released = false;
  const release = () => { if (!released) { active = false; released = true; } };
  res.once('finish', release);
  // Keep the guard until work finishes even if the caller disconnects.
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && getDataRevision() === revision) {
      const bytes = Buffer.byteLength(JSON.stringify(body));
      if (bytes <= MAX_BYTES) {
        while (cache.size && retainedBytes + bytes > MAX_BYTES) {
          const oldest = cache.keys().next().value;
          retainedBytes -= cache.get(oldest).bytes;
          cache.delete(oldest);
        }
        cache.set(key, { body, bytes, revision, expires: Date.now() + TTL });
        retainedBytes += bytes;
      }
    }
    release();
    return json(body);
  };
  next();
};
