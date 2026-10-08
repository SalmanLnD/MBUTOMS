import { isIP } from 'node:net';

export const createPunchNetworkCheck = ({ env = process.env, request = (...args) => fetch(...args), now = Date.now } = {}) => {
  const cache = new Map();
  return async req => {
    const ip = req.ip?.replace(/^::ffff:/, '');
    const key = env.PUNCH_PROXYCHECK_API_KEY;
    if (!key || !isIP(ip) || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(ip) || ip === '::1' || /^(fc|fd|fe80:)/i.test(ip)) return 'unknown';
    const cached = cache.get(ip);
    if (cached?.key === key && cached.until > now()) return cached.result;
    try {
      const response = await request(`https://proxycheck.io/v3/${encodeURIComponent(ip)}?${new URLSearchParams({key, tag:'0'})}`, { signal: AbortSignal.timeout(8000) });
      const data = await response.json();
      const detections = data[ip]?.detections;
      if (!response.ok || !['ok', 'warning'].includes(data.status) || typeof detections?.anonymous !== 'boolean') return 'unknown';
      const result = detections.anonymous ? 'blocked' : 'clear';
      // Short cache shares capture and submission checks without spending three queries per photo.
      if (cache.size >= 2000) cache.delete(cache.keys().next().value);
      cache.set(ip, {key, result, until: now() + 60000});
      return result;
    } catch { return 'unknown'; }
  };
};
export const networkCheck = createPunchNetworkCheck();
