import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Password/PIN hashing using Node's built-in scrypt (no native deps).
 * Format: "scrypt$<saltHex>$<hashHex>". Replaces legacy bcrypt; same purpose (BR-28).
 */
export function hashSecret(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifySecret(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(plain, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
