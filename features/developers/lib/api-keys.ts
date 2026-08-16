import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DeveloperAppEnvironment } from "@/lib/generated/prisma/client";

export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashesEqual(leftHex: string, rightHex: string): boolean {
  try {
    const a = Buffer.from(leftHex, "hex");
    const b = Buffer.from(rightHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function generateApiKey(environment: DeveloperAppEnvironment): {
  prefix: string;
  secret: string;
  full: string;
  secretHash: string;
} {
  const publicPrefix = randomBytes(6).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const env = environment === "PRODUCTION" ? "live" : "sandbox";
  const prefix = `koba_${env}_${publicPrefix}`;
  const full = `${prefix}_${secret}`;
  return { prefix, secret, full, secretHash: hashApiKeySecret(full) };
}

export function parseApiKey(value: string): { prefix: string } | null {
  const trimmed = value.trim();
  const match = /^(koba_(?:sandbox|live)_[a-f0-9]{12})_/.exec(trimmed);
  if (!match?.[1]) return null;
  return { prefix: match[1] };
}
