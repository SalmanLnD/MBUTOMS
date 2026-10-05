import jwt from 'jsonwebtoken';

export const DEMO_ROLE = 'demo';
export const maskDemoValue = (value) => {
  if (value == null || value === '' || value === '-') return value;
  const chars = Array.from(String(value)), visible = chars.length === 1 ? 0 : Math.ceil(chars.length / 2);
  return chars.slice(0, visible).join('') + 'x'.repeat(chars.length - visible);
};
export const maskDemoCredentials = (value) => {
  if (Array.isArray(value)) return value.map(maskDemoCredentials);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ['camuErpId', 'camuPassword'].includes(key) ? maskDemoValue(item) : maskDemoCredentials(item)]));
  if ('camuErpId' in value || 'camuPassword' in value) result._demoMaskedCredentials = true;
  return result;
};
const SESSION_ACTIONS = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/impersonate', '/api/auth/stop-impersonation']);
export const isDemoRequestAllowed = (req) => {
  const path = req.originalUrl?.split('?')[0];
  // Bridge GET /claim assigns a job, so it is not a read-only operation.
  if (path?.startsWith('/api/webhooks/')) return false;
  return ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    || (req.method === 'POST' && (SESSION_ACTIONS.has(path) || path === '/api/ai/chat'));
};
export const rejectDemoWrite = (res) => res.status(403).json({
  code: 'DEMO_READ_ONLY', message: 'Demo changes stay in your browser. This account cannot change server data.',
});

// Also covers public/key-authenticated routes that do not run protect().
export const guardDemoToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    req.hasDemoToken = Boolean(token && jwt.verify(token, process.env.JWT_SECRET).demo);
    if (req.hasDemoToken && !isDemoRequestAllowed(req)) return rejectDemoWrite(res);
  } catch { /* Protected routes perform complete authentication. */ }
  next();
};
