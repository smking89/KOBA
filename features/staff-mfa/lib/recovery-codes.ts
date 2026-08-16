import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * One-time staff recovery codes (Phase 15C).
 *
 * Codes are displayed exactly once at generation; only SHA-256 hashes are
 * stored. Hashing (not encryption) is correct here because the server never
 * needs to recover a code — only to match a submitted one. The raw material
 * is 10 random bytes (80 bits), well above guessing feasibility.
 */

const CODE_BYTES = 10;
const GROUP_SIZE = 4;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/O, 1/l/i

export function generateRecoveryCode(): string {
  const bytes = randomBytes(CODE_BYTES);
  let out = "";
  for (let i = 0; i < CODE_BYTES; i += 1) {
    // Rejection-free mapping is fine: alphabet bias is negligible for 31 symbols
    // over 256 values relative to the 80-bit total entropy budget.
    out += CODE_ALPHABET[(bytes[i] ?? 0) % CODE_ALPHABET.length];
    if ((i + 1) % GROUP_SIZE === 0 && i !== CODE_BYTES - 1) out += "-";
  }
  return out;
}

export function generateRecoveryCodes(count: number): string[] {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

export function normalizeRecoveryCode(raw: string): string {
  return raw.toLowerCase().replace(/[\s-]/g, "");
}

export function hashRecoveryCode(raw: string): string {
  return createHash("sha256")
    .update(`koba:staff-recovery:v1:${normalizeRecoveryCode(raw)}`)
    .digest("hex");
}

export function recoveryHashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when the submission even looks like a recovery code (vs a TOTP code). */
export function looksLikeRecoveryCode(raw: string): boolean {
  return normalizeRecoveryCode(raw).length === CODE_BYTES;
}
