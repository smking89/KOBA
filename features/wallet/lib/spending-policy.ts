import type { CoinBucket } from "@/lib/generated/prisma/client";

/** Buckets that can fund spends (not RESERVED). */
export const SPENDABLE_BUCKETS = [
  "PROMOTIONAL",
  "PURCHASED",
  "EARNED",
] as const satisfies readonly CoinBucket[];

export type SpendableBucket = (typeof SPENDABLE_BUCKETS)[number];

/**
 * Default spending order for reservations and captures.
 * Promotional first (non-refundable for cash), then purchased, then earned.
 * Configurable via `resolveSpendOrder`.
 */
export const DEFAULT_SPEND_ORDER: readonly SpendableBucket[] = [
  "PROMOTIONAL",
  "PURCHASED",
  "EARNED",
] as const;

export type SpendPolicy = {
  order: readonly SpendableBucket[];
};

export function resolveSpendOrder(policy?: Partial<SpendPolicy>): readonly SpendableBucket[] {
  const order = policy?.order ?? DEFAULT_SPEND_ORDER;
  const unique = [...new Set(order)];
  if (unique.length !== SPENDABLE_BUCKETS.length) {
    return DEFAULT_SPEND_ORDER;
  }
  for (const bucket of unique) {
    if (!SPENDABLE_BUCKETS.includes(bucket)) {
      return DEFAULT_SPEND_ORDER;
    }
  }
  return unique as SpendableBucket[];
}

export type Allocation = { bucket: SpendableBucket; amount: bigint };

/** Allocate `amount` across balances using spending order. */
export function allocateSpend(
  amount: bigint,
  balances: Record<SpendableBucket, bigint>,
  policy?: Partial<SpendPolicy>,
): Allocation[] {
  if (amount <= 0n) {
    throw new Error("Allocation amount must be positive.");
  }
  let remaining = amount;
  const allocations: Allocation[] = [];
  for (const bucket of resolveSpendOrder(policy)) {
    const available = balances[bucket];
    if (available <= 0n) continue;
    const take = available < remaining ? available : remaining;
    if (take > 0n) {
      allocations.push({ bucket, amount: take });
      remaining -= take;
    }
    if (remaining === 0n) break;
  }
  if (remaining > 0n) {
    throw new Error("INSUFFICIENT");
  }
  return allocations;
}
