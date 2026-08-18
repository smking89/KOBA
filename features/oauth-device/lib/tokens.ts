import { createHash, randomBytes } from "node:crypto";

/** Namespaced hashes (same convention as staff-mfa's session-issue
 * tickets and the login-OAuth ticket) so a device code and an access
 * token can never be swapped for each other even if both leaked
 * side-by-side. */
export function hashDeviceCode(raw: string): string {
  return createHash("sha256").update(`koba:oauth-device-code:v1:${raw}`).digest("hex");
}

export function newDeviceCode(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashDeviceCode(raw) };
}

export function hashAccessToken(raw: string): string {
  return createHash("sha256").update(`koba:oauth-access-token:v1:${raw}`).digest("hex");
}

export function newAccessToken(): { raw: string; hash: string } {
  const raw = randomBytes32Prefixed();
  return { raw, hash: hashAccessToken(raw) };
}

function randomBytes32Prefixed(): string {
  // "koba_at_" prefix makes a leaked token grep-able/recognizable in logs,
  // same idea as Stripe's/GitHub's prefixed token formats.
  return `koba_at_${randomBytes(32).toString("base64url")}`;
}

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** RFC 8628-style short human-typeable code, e.g. "WDJB-MJHT". */
export function newUserCode(): string {
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i += 1) {
    const byte = bytes[i] ?? 0;
    code += USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
    if (i === 3) code += "-";
  }
  return code;
}
