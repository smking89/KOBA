/**
 * HMAC-SHA256 request signing for the Method B plugin/webhook channel.
 * Client, 2026-08-18 (KOBA-vs-Tip4Serv architecture spec): "All
 * communication between KOBA and client servers must use HMAC SHA256
 * request signatures with unique, rotatable server API keys to prevent
 * malicious command injection."
 *
 * Deliberately its own scheme, not a reuse of features/payments/lib/
 * webhook-verify.ts (Stripe→KOBA) — direction is reversed here
 * (plugin→KOBA), and the secret is KOBA-issued per server rather than
 * a single platform-wide Stripe webhook secret. Header shape mirrors
 * Stripe's own `t=<timestamp>,v1=<hmac>` convention deliberately, since
 * it's a well-understood, replay-resistant pattern plugin authors can
 * follow without KOBA inventing something novel.
 *
 * The secret is sealed with lib/crypto/secret-box.ts (same AES-256-GCM
 * round-trip ServerCredential's RCON password already uses in this
 * codebase), not one-way hashed — verifying an HMAC means recomputing
 * it, which needs the plaintext secret, not just a hash of it.
 */
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { openSecret, sealSecret, type SealedSecret } from "@/lib/crypto/secret-box";

const KEY_PREFIX_LENGTH = 12;
const SIGNATURE_TOLERANCE_MS = 5 * 60_000; // 5 minutes, same window Stripe itself uses

export type GeneratedApiKey = {
  secret: string;
  keyPrefix: string;
  sealed: SealedSecret;
};

/** New KOBA-issued plugin secret. Only the sealed (encrypted) form is
 * ever persisted — the plaintext secret is returned once, to be shown
 * to the seller exactly once at rotation time (same handling as a
 * Steam trade-offer token or a device OAuth client secret elsewhere in
 * this codebase). */
export function generatePluginApiKey(): GeneratedApiKey {
  const secret = `koba_gw_${randomBytes(24).toString("hex")}`;
  return {
    secret,
    keyPrefix: secret.slice(0, KEY_PREFIX_LENGTH),
    sealed: sealSecret(secret),
  };
}

/** Verifies a plugin's `X-KOBA-Signature: t=<unixMs>,v1=<hex hmac>`
 * header against `hmac_sha256(secret, "<timestamp>.<rawBody>")`,
 * rejecting stale timestamps to bound replay — mirrors Stripe's own
 * webhook verification shape. Returns false rather than throwing so
 * every caller is forced to handle the failure path (no accidental
 * "verification threw, but the route ignored it and proceeded" bug). */
export function verifyPluginSignature(input: {
  sealed: SealedSecret;
  rawBody: string;
  header: string | null;
  now?: number;
}): boolean {
  if (!input.header) return false;

  const parts = Object.fromEntries(
    input.header.split(",").map((segment) => {
      const [key, value] = segment.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const timestamp = Number.parseInt(parts.t ?? "", 10);
  const providedSignature = parts.v1;
  if (!Number.isFinite(timestamp) || !providedSignature) return false;

  const now = input.now ?? Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_MS) return false;

  let secret: string;
  try {
    secret = openSecret(input.sealed);
  } catch {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(providedSignature);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
