import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  credentialAad as unusedAad,
  openCredential,
  sealCredential,
  type SealedCredential,
} from "@/lib/crypto/credential-box";

void unusedAad;

export function webhookSecretAad(endpointId: string): Buffer {
  return Buffer.from(`koba:dev-webhook:v1:${endpointId}`, "utf8");
}

export function generateWebhookSecret(): { secret: string; prefix: string } {
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 12) };
}

export function sealWebhookSecret(secret: string, endpointId: string): SealedCredential {
  return sealCredential(secret, webhookSecretAad(endpointId));
}

export function openWebhookSecret(sealed: SealedCredential, endpointId: string): string {
  return openCredential(sealed, webhookSecretAad(endpointId));
}

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = signWebhookPayload(secret, timestamp, body);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function payloadHash(eventType: string, body: string): string {
  return createHash("sha256").update(`${eventType}:${body}`).digest("hex");
}

export function isReplayTimestamp(
  timestampIso: string,
  now = Date.now(),
  windowMs = 5 * 60 * 1000,
): boolean {
  const ts = Date.parse(timestampIso);
  if (!Number.isFinite(ts)) return true;
  return Math.abs(now - ts) > windowMs;
}
