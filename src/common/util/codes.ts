import { randomBytes, randomInt } from 'crypto';

/**
 * Voucher credential generation — mirrors legacy generate_voucher_code()
 * (VOUCHER_ENGINE.md §3). Uses CSPRNG. Patterns preserved.
 */
export type CodePattern = 'numeric' | 'alpha' | 'alphanumeric' | 'safe';

const CHARSETS: Record<CodePattern, string> = {
  numeric: '0123456789',
  alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alphanumeric: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  // "safe": no 0/1/o/l/i to avoid confusion (matches legacy)
  safe: '23456789abcdefghjkmnpqrstuvwxyz',
};

export function generateCode(
  pattern: CodePattern,
  length: number,
  prefix = '',
  suffix = '',
): string {
  const chars = CHARSETS[pattern] ?? CHARSETS.alphanumeric;
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[randomInt(0, chars.length)];
  }
  return `${prefix}${out}${suffix}`;
}

/** Stable order reference: "WIFI-<unix>-<rand hex>" — mirrors legacy merchant_ref (BR-5). */
export function generateMerchantRef(nowMs: number): string {
  return `WIFI-${Math.floor(nowMs / 1000)}-${randomBytes(6).toString('hex')}`;
}

/** Normalize an Indonesian WhatsApp number to JID-friendly 62… form (BR-8). */
export function normalizeWhatsapp(input: string): string | null {
  const digits = (input || '').replace(/[^0-9]/g, '');
  if (!/^[0-9]{9,15}$/.test(digits)) return null;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}
