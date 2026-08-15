/**
 * Fixed, hardcoded Coin package catalog. A known simplification — same
 * pattern as this repo's other "deferred: admin-configurable table" spots
 * (PlatformFeeSchedule seeds one default row, escrow hold days is an env
 * var). A real admin-managed pricing table is future work; for now these
 * four packages are the entire purchasable catalog.
 */
export type CoinPackage = {
  id: string;
  label: string;
  priceCents: number;
  coinAmount: bigint;
  /** Marketing-only bonus percentage vs. the base $0.01-per-Coin rate, for display. */
  bonusPercent: number;
};

const BASE_RATE_COINS_PER_CENT = 1; // $0.01 = 1 Coin at the base (no-bonus) rate.

export const COIN_PACKAGES: readonly CoinPackage[] = [
  { id: "starter", label: "Starter", priceCents: 499, coinAmount: 500n, bonusPercent: 0 },
  { id: "plus", label: "Plus", priceCents: 999, coinAmount: 1100n, bonusPercent: 10 },
  { id: "pro", label: "Pro", priceCents: 2499, coinAmount: 3000n, bonusPercent: 20 },
  { id: "ultra", label: "Ultra", priceCents: 4999, coinAmount: 6500n, bonusPercent: 30 },
] as const;

export function getCoinPackage(id: string): CoinPackage | null {
  return COIN_PACKAGES.find((pack) => pack.id === id) ?? null;
}

export function listCoinPackages(): readonly CoinPackage[] {
  return COIN_PACKAGES;
}

/** Pure validation: every package must actually pay out at or above the
 * advertised bonus over the base rate, and never below it (no silent
 * downgrade), so a config typo can't accidentally under- or over-pay. */
export function isCoinPackageConsistent(pack: CoinPackage): boolean {
  if (pack.priceCents <= 0 || pack.coinAmount <= 0n) {
    return false;
  }
  const baseCoins = BigInt(pack.priceCents) * BigInt(BASE_RATE_COINS_PER_CENT);
  const expectedMinimum = baseCoins + (baseCoins * BigInt(pack.bonusPercent)) / 100n;
  return pack.coinAmount >= expectedMinimum;
}
