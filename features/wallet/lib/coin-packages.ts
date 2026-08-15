/**
 * Fixed, hardcoded Coin package catalog. A known simplification — same
 * pattern as this repo's other "deferred: admin-configurable table" spots
 * (PlatformFeeSchedule seeds one default row, escrow hold days is an env
 * var). A real admin-managed pricing table is future work; for now these
 * four packages are the entire purchasable catalog.
 *
 * Console-store-style coin packs (2026-08-15 client direction, styled
 * after Rust's own coin-pack pricing ladder): one-time purchases, buy
 * any time, non-refundable — not a subscription, not recurring billing.
 * "Non-refundable" isn't just UI copy: there is no refund code path for
 * CoinPurchase anywhere in this codebase (features/payments's
 * refundOrder only ever operates on marketplace Order rows) — this was
 * already true by omission, now it's a confirmed, deliberate policy, so
 * the checkout line item and wallet UI say so explicitly rather than
 * leaving it an accident someone could "fix" later by wiring a refund
 * path that shouldn't exist for Coins.
 *
 * Pricing model (confirmed): 1 Coin ≈ $0.10 of real GPU/model cost KOBA
 * pays a generation vendor — unchanged from before; a KOBA Coin's real
 * value (1 Coin = 1 SDXL image, etc. — features/aiden/lib/model-costs.ts)
 * is NOT being redefined here, only the package/pricing-ladder shape is.
 * Target ~30% margin over that $0.10 cost basis, escalating (bigger pack
 * = better rate) same as the price ladder these replace — validated via
 * the pricing-strategy skill: margins run 34.9% -> 31.4% -> 29.8% ->
 * 27.2%, monotonically decreasing, blended average ~30.8%.
 */
export type CoinPackage = {
  id: string;
  label: string;
  priceCents: number;
  coinAmount: bigint;
};

/** Real GPU/model cost KOBA pays per Coin, in cents. Used to convert a
 * generation provider's reported actualCostUsd into Coins for audit
 * (features/aiden/lib/cost.ts) — this is KOBA's cost basis, deliberately
 * NOT the ~13-cent price Coins are sold to users at (SELL_RATE_CENTS_PER_COIN
 * below), since coinCostActual should reflect what the generation truly
 * cost, not the markup. */
export const MODEL_COST_CENTS_PER_COIN = 10;

/** Approximate price Coins are sold to users at, in cents — informational
 * only (the actual sell price comes from COIN_PACKAGES below, which round
 * to clean price points rather than being priced at this rate exactly). */
export const SELL_RATE_CENTS_PER_COIN = 13;

export const COIN_PACKAGES: readonly CoinPackage[] = [
  { id: "small", label: "37 Coins", priceCents: 499, coinAmount: 37n },
  { id: "medium", label: "76 Coins", priceCents: 999, coinAmount: 76n },
  { id: "large", label: "154 Coins", priceCents: 1999, coinAmount: 154n },
  { id: "mega", label: "275 Coins", priceCents: 3499, coinAmount: 275n },
] as const;

export function getCoinPackage(id: string): CoinPackage | null {
  return COIN_PACKAGES.find((pack) => pack.id === id) ?? null;
}

export function listCoinPackages(): readonly CoinPackage[] {
  return COIN_PACKAGES;
}

/**
 * Pure validation: every package's effective per-Coin price must land in a
 * sane band around the confirmed ~$0.13/Coin sell rate — catches a typo
 * that would accidentally give away Coins far below cost (below
 * MODEL_COST_CENTS_PER_COIN, KOBA loses money on every Coin sold) or
 * overcharge wildly above the intended rate.
 */
const MIN_CENTS_PER_COIN = MODEL_COST_CENTS_PER_COIN; // never sell at/below raw cost
const MAX_CENTS_PER_COIN = 20; // generous ceiling above the ~13-cent target

export function isCoinPackageConsistent(pack: CoinPackage): boolean {
  if (pack.priceCents <= 0 || pack.coinAmount <= 0n) {
    return false;
  }
  const centsPerCoin = pack.priceCents / Number(pack.coinAmount);
  return centsPerCoin > MIN_CENTS_PER_COIN && centsPerCoin <= MAX_CENTS_PER_COIN;
}

// Runtime guardrail: a future edit to COIN_PACKAGES that breaks the
// price/Coin ratio fails fast at module load (and therefore at build/test
// time) rather than only in the unit test file that exercises this same
// function — no client input reaches this catalog, but a bad constant edit
// should never silently ship.
for (const pack of COIN_PACKAGES) {
  if (!isCoinPackageConsistent(pack)) {
    throw new Error(`Inconsistent Coin package "${pack.id}": price/coinAmount out of band.`);
  }
}
