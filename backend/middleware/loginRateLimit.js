// Per-process protection; a shared store or edge limit is needed across replicas.
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

export const loginRateLimit = createLoginRateLimiter();
