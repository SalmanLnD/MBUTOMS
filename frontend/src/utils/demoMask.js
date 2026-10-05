export const maskDemoValue = (value) => {
  if (value == null || value === '' || value === '-') return value ?? '-';
  const chars = Array.from(String(value));
  const visible = chars.length === 1 ? 0 : Math.ceil(chars.length / 2);
  return chars.slice(0, visible).join('') + 'x'.repeat(chars.length - visible);
};
