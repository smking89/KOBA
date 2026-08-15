/**
 * Boost economics. Duration and multiplier are client-specified and
 * fixed (ROADMAP.md Phase 15, 2026-08-15): 10 minutes, 3x exposure.
 *
 * BOOST_COIN_COST is NOT client-specified — it's a placeholder so the
 * feature is testable end-to-end. Do not treat this number as final;
 * see ROADMAP.md Phase 15 open question #1. 20 Coins ≈ $2.60 at the
 * $0.13/coin sell rate (features/wallet/lib/coin-packages.ts), chosen
 * as a plausible order of magnitude for a one-shot promotional spend,
 * not a confirmed price.
 */
export const BOOST_COIN_COST = 20;
export const BOOST_DURATION_MS = 10 * 60 * 1000;
export const BOOST_MULTIPLIER = 3;
