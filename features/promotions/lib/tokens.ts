import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const REFERRAL_COOKIE = "koba_ref";
export const ATTRIBUTION_COOKIE = "koba_attr";

export function generateReferralToken(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  const hex = Buffer.from(bytesFn(12)).toString("hex");
  return `kref_${hex}`;
}

export function generateOpaqueRef(
  prefix: string,
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return `${prefix}${Buffer.from(bytesFn(4)).toString("hex").toUpperCase()}`;
}

export function normalizePromoCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);
}

function signingKey(): string {
  return process.env.AUTH_SECRET?.trim() || "koba-dev-attribution-key";
}

export function signAttributionCookie(token: string, expiresAtMs: number): string {
  const payload = `${token}.${expiresAtMs}`;
  const sig = createHmac("sha256", signingKey()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function readSignedAttributionCookie(
  value: string | undefined,
  nowMs = Date.now(),
): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [token, expRaw, sig] = parts;
  if (!token || !expRaw || !sig) return null;
  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exp) || exp < nowMs) return null;
  const expected = createHmac("sha256", signingKey()).update(`${token}.${expRaw}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return token;
}

export function visitorHash(ip: string | null | undefined, dayKey: string): string {
  return createHmac("sha256", signingKey())
    .update(`promo:${dayKey}:${ip ?? "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

export function attributionWindowHours(raw?: number | null): number {
  if (raw && raw > 0) return raw;
  const env = Number.parseInt(process.env.KOBA_ATTRIBUTION_WINDOW_HOURS ?? "168", 10);
  return Number.isFinite(env) && env > 0 ? env : 168;
}

export function clickBurstLimit(): number {
  const parsed = Number.parseInt(process.env.KOBA_REFERRAL_CLICK_BURST ?? "20", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

export function promoGuessLimit(): number {
  const parsed = Number.parseInt(process.env.KOBA_PROMO_GUESS_LIMIT ?? "10", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}
