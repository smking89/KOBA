import { randomBytes } from "node:crypto";

function hexRef(prefix: string, bytesFn: (size: number) => Uint8Array): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefix}${hex}`;
}

export function generateCampaignRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-CMP-", bytesFn);
}

export function generateParticipationRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-PRT-", bytesFn);
}

export function generateCommissionRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-COM-", bytesFn);
}

export function generateClickRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-CLK-", bytesFn);
}

export function generateSponsoredRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-AD-", bytesFn);
}

export function generateEventRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-EVT-", bytesFn);
}

export function slugifyInfluencer(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "creator";
}

export function campaignReferralPath(token: string): string {
  return `/r/${encodeURIComponent(token)}`;
}
