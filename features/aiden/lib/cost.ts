import { BASE_RATE_COINS_PER_CENT } from "@/features/wallet/lib/coin-packages";

/** Converts a provider's real USD generation cost into KOBA Coins, at the
 * same base rate live Coin purchases use ($0.01 = 1 Coin), rounded up so
 * KOBA never under-charges for a generation that cost more than the coin
 * granularity can express exactly. */
export function usdToCoins(usdCost: number): number {
  if (!Number.isFinite(usdCost) || usdCost < 0) {
    throw new RangeError("USD cost must be a non-negative finite number.");
  }
  const cents = usdCost * 100;
  return Math.ceil(cents * BASE_RATE_COINS_PER_CENT);
}
