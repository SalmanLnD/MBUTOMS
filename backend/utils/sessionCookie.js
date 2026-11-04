import { isOriginAllowed } from './cors.js';

const COOKIE = 'toms_session';
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' });

export const setSessionCookie = (res, token) => res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
export const clearSessionCookie = res => res.clearCookie(COOKIE, cookieOptions());
export const getCookieToken = req => {
  const pair = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
  if (!pair) return null;
  try { return decodeURIComponent(pair.slice(COOKIE.length + 1)); } catch { return null; }
};
export const getSessionToken = req => req.headers.authorization?.startsWith('Bearer ')
  ? req.headers.authorization.slice(7) : getCookieToken(req);

export const protectCookieRequest = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const needsCheck = Boolean(getCookieToken(req)) || req.path === '/api/auth/login';
  if (!needsCheck) return next();
  const origin = req.headers.origin;
  // Same-origin requests may omit Origin. Fetch Metadata is browser-controlled;
  // never infer trust from a forwarded host supplied by a client.
  const trustedSource = origin ? isOriginAllowed(origin) : req.headers['sec-fetch-site'] === 'same-origin';
  if (!trustedSource || req.headers['x-toms-request'] !== '1') {
    return res.status(403).json({ message: 'Request origin or security header is invalid.' });
  }
  return next();
};
