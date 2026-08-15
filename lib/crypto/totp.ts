import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30-second period) for staff MFA.
 *
 * Time is always server-controlled: callers pass `Date.now()` (or a fixed
 * timestamp in tests). Verification returns the matched time step so callers
 * can persist it and reject replays of an already-accepted step.
 */

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Documented skew allowance: ±1 step (30 seconds each side). */
export const TOTP_SKEW_STEPS = 1;
const SECRET_BYTES = 20;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 character in TOTP secret.");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit cryptographically random secret, base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

export function timeStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const code =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);
  return (code % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

/** The valid code for a given timestamp; exposed for deterministic tests. */
export function totpCodeAt(secret: string, nowMs: number): string {
  return hotp(secret, timeStep(nowMs));
}

function codesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type TotpVerification = { ok: true; step: number } | { ok: false };

/**
 * Verify a submitted code within the documented ±1-step skew window.
 * `minStepExclusive` is the highest previously accepted step: any code for a
 * step at or below it is rejected, which prevents replay of an accepted code.
 */
export function verifyTotp(
  secret: string,
  submitted: string,
  options: { nowMs: number; minStepExclusive?: number | null },
): TotpVerification {
  const normalized = submitted.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(normalized)) return { ok: false };
  const current = timeStep(options.nowMs);
  for (let offset = -TOTP_SKEW_STEPS; offset <= TOTP_SKEW_STEPS; offset += 1) {
    const step = current + offset;
    if (step < 0) continue;
    if (options.minStepExclusive != null && step <= options.minStepExclusive) continue;
    if (codesEqual(hotp(secret, step), normalized)) {
      return { ok: true, step };
    }
  }
  return { ok: false };
}

/** otpauth:// URI for authenticator apps (rendered client-side, never stored). */
export function buildOtpauthUri(input: {
  issuer: string;
  accountName: string;
  secret: string;
}): string {
  const issuer = encodeURIComponent(input.issuer);
  const account = encodeURIComponent(input.accountName);
  return `otpauth://totp/${issuer}:${account}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}
