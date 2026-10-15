/**
 * Escapes special regex characters from user-supplied input strings
 * to prevent NoSQL regex injection and ReDoS (Regular Expression Denial of Service).
 */
export const escapeRegex = (string) => {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export default escapeRegex;
