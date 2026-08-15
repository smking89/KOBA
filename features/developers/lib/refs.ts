import { randomBytes } from "node:crypto";

function hexRef(prefix: string, bytesFn: (size: number) => Uint8Array): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefix}${hex}`;
}

export function generateDevProductRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-DEV-", bytesFn);
}

export function generateDevAppRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-DAPP-", bytesFn);
}

export function generateDevWebhookRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-DWH-", bytesFn);
}

export function generateDevPurchaseRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-DPUR-", bytesFn);
}

export function generateDevVersionRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-DVER-", bytesFn);
}

export function generateDeliveryId(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-DDEL-", bytesFn);
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "publisher";
}
