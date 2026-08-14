import { randomBytes } from "node:crypto";

function hexRef(prefix: string, bytesFn: (size: number) => Uint8Array): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefix}${hex}`;
}

export function generateServerRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-SRV-", bytesFn);
}

export function slugifyServer(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "server";
}
