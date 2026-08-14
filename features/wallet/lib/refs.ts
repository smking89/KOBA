import { randomBytes } from "node:crypto";

function hexRef(prefix: string, bytesFn: (size: number) => Uint8Array): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefix}${hex}`;
}

export function generateLedgerRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  return hexRef("KOBA-LDG-", bytesFn);
}
