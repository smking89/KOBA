import { MODEL_COST_CENTS_PER_COIN } from "@/features/wallet/lib/coin-packages";

/** Converts a provider's real USD generation cost into KOBA Coins, at
 * KOBA's own cost basis (MODEL_COST_CENTS_PER_COIN — ~$0.10 = 1 Coin),
 * NOT the ~$0.13 rate Coins are sold to users at. This is for the
 * fallback/audit path (an unlisted provider reporting its own metered
 * cost) — named providers with a fixed per-generation Coin price (see
 * docs/aiden-model-costs.md) don't need this at all, their cost is a
 * flat lookup, not computed from a live USD figure. Rounds up so KOBA
 * never under-charges for a generation that cost more than the Coin
 * granularity can express exactly. */
export function usdToCoins(usdCost: number): number {
  if (!Number.isFinite(usdCost) || usdCost < 0) {
    throw new RangeError("USD cost must be a non-negative finite number.");
  }
  const cents = usdCost * 100;
  return Math.ceil(cents / MODEL_COST_CENTS_PER_COIN);
}
