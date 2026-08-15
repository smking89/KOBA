/**
 * Fixed, hardcoded Coin package catalog. A known simplification — same
 * pattern as this repo's other "deferred: admin-configurable table" spots
 * (PlatformFeeSchedule seeds one default row, escrow hold days is an env
 * var). A real admin-managed pricing table is future work; for now these
 * five packages are the entire purchasable catalog.
 *
 * Pricing model (confirmed): 1 Coin ≈ $0.10 of real GPU/model cost KOBA
 * pays a generation vendor; KOBA sells Coins at ≈$0.13 each (a 30% margin
 * over that cost — see docs/aiden-model-costs.md for the full per-model
 * coin-cost table this feeds). The five tiers below are priced at
 * approximately that $0.13/Coin rate with minor rounding to land on clean
 * price points — NOT an escalating bonus-percent structure like this
 * catalog's previous four-tier version.
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
  { id: "starter", label: "Starter", priceCents: 999, coinAmount: 75n },
  { id: "creator", label: "Creator", priceCents: 1999, coinAmount: 150n },
  { id: "studio", label: "Studio", priceCents: 4999, coinAmount: 380n },
  { id: "pro", label: "Pro", priceCents: 9999, coinAmount: 770n },
  { id: "enterprise", label: "Enterprise", priceCents: 24999, coinAmount: 1920n },
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
