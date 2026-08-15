import { randomBytes } from "node:crypto";

export function generatePlusRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `KOBA-PLS-${hex}`;
}
