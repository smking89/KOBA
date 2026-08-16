import { randomBytes } from "node:crypto";

function hexRef(prefix: string, bytesFn: (size: number) => Uint8Array): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefix}${hex}`;
}

export function generateReferralRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-REF-", bytesFn);
}

export function generateEarningRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-ERN-", bytesFn);
}

export function buildReferralCode(handle: string, productSlug: string): string {
  const owner = handle
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 24);
  const product = productSlug
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toUpperCase()
    .slice(0, 40);
  if (owner.length < 2 || product.length < 1) {
    return "";
  }
  return `${owner}-${product}`.slice(0, 72);
}

export function normalizeReferralCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 72);
}

export function referralSharePath(code: string): string {
  return `/r/${encodeURIComponent(code)}`;
}
