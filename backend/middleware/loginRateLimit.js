import { createHash } from 'node:crypto';
import LoginAttemptBucket from '../models/LoginAttemptBucket.js';

// Injectable in-memory limiter for callers that need a local-only budget.
export const createLoginRateLimiter = ({ max = 10, windowMs = 15 * 60 * 1000, clock = Date.now } = {}) => {
  const attempts = new Map();
  return (req, res, next) => {
    const now = clock();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const ip = req.ip || 'unknown';
    let entry = attempts.get(ip);
    if (!entry) {
      if (attempts.size >= 10000) return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
      entry = { count: 0, until: now + windowMs };
      attempts.set(ip, entry);
    }
    if (entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
    }
    entry.count += 1;
    return next();
  };
};

export const createDistributedLoginRateLimiter = ({ store = LoginAttemptBucket, max = 30, windowMs = 15 * 60 * 1000, clock = Date.now } = {}) => async (req, res, next) => {
  const now = clock();
  const bucket = Math.floor(now / windowMs);
  const ip = createHash('sha256').update(req.ip || 'unknown').digest('hex');
  const filter = { _id: `${bucket}:${ip}` };
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) } };
  try {
    let entry;
    try {
      entry = await store.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: false });
    } catch (error) {
      if (error.code !== 11000) throw error;
      entry = await store.findOneAndUpdate(filter, update, { new: true });
    }
    if (!entry || entry.count > max) {
      res.set('Retry-After', String(Math.ceil(((bucket + 1) * windowMs - now) / 1000)));
      return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
    }
    return next();
  } catch {
    return res.status(503).json({ message: 'Login is temporarily unavailable. Please try again.' });
  }
};

export const loginRateLimit = createDistributedLoginRateLimiter();
