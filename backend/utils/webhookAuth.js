import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of webhook secrets to protect against timing attacks.
 */
export const isTimingSafeSecretMatch = (provided, expected) => {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export default isTimingSafeSecretMatch;
