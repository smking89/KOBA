import { randomBytes } from "node:crypto";

function generateRef(
  prefix: string,
  bytesFn: (size: number) => Uint8Array = (size) => randomBytes(size),
): string {
  const bytes = bytesFn(4);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefix}-${hex}`;
}

export function generateOrderRef(bytesFn?: (size: number) => Uint8Array): string {
  return generateRef("KOBA-ORD", bytesFn);
}

/** ProductSubscription's own ref series — distinct prefix so a support
 * agent can tell a recurring VIP subscription apart from a one-time
 * order at a glance. */
export function generateSubscriptionRef(bytesFn?: (size: number) => Uint8Array): string {
  return generateRef("KOBA-SUB", bytesFn);
}
