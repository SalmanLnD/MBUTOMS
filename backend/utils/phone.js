/**
 * Reduce any phone representation to a comparable key.
 *
 * Trainers are stored with local 10-digit numbers (e.g. "9876543210"),
 * while WhatsApp reports them with a country code (e.g. "919876543210"
 * or "+91 98765 43210"). We compare on the last 10 significant digits so
 * both formats resolve to the same trainer.
 */
export const normalizePhone = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * A usable mobile key is exactly 10 digits and not an obvious placeholder
 * (e.g. "0000000000" or "9999999999"), so junk/placeholder trainer phones
 * never catch a real punch-in.
 */
export const isValidMobileKey = (value) => {
  const normalized = normalizePhone(value);
  if (normalized.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(normalized)) return false;
  return true;
};

export const phonesMatch = (a, b) => {
  const normA = normalizePhone(a);
  const normB = normalizePhone(b);
  return isValidMobileKey(normA) && normA === normB;
};
