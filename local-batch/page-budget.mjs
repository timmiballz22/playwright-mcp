// Trusted operator policy. Observed open pages, not an OS process/RAM quota.
export const DEFAULT_MAX_PAGES = 8;
export function validatePageLimit(value = DEFAULT_MAX_PAGES) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 32) throw new TypeError('Invalid operator page limit');
  return value;
}
export function parsePageLimit(value) {
  if (value === undefined) return DEFAULT_MAX_PAGES;
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value)) throw new TypeError('Invalid operator page limit');
  return validatePageLimit(Number(value));
}
