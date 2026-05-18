/**
 * Normalize an email string: trim whitespace and lowercase.
 * Email addresses are case-insensitive per RFC 5321 §2.4 (the local part may
 * be case-sensitive in theory, but in practice all major providers treat them
 * as case-insensitive). We store/compare them lowercased to avoid duplicate
 * accounts like "Dolores@hotmail.com" vs "dolores@hotmail.com".
 *
 * Safe to call with non-string values — returns the original value untouched.
 */
export function normalizeEmail<T>(value: T): T {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase() as unknown as T;
}
