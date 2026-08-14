import { randomBytes } from "node:crypto";

export function generateOrderRef(
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `KOBA-ORD-${hex}`;
}
