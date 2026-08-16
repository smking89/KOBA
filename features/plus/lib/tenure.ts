export const TENURE_BADGE_TIERS = ["BRONZE", "SILVER", "GOLD", "DIAMOND"] as const;
export type TenureBadgeTier = (typeof TENURE_BADGE_TIERS)[number];

/**
 * Tenure thresholds, in whole months of continuous-since-first-activation
 * subscription. NOT client-specified — a placeholder so the perk is
 * real and testable end-to-end, same convention as
 * features/boost/lib/pricing.ts's BOOST_COIN_COST. Easy to retune later:
 * change the numbers here, nothing else.
 */
const TIER_THRESHOLDS_MONTHS: Record<TenureBadgeTier, number> = {
  BRONZE: 0,
  SILVER: 3,
  GOLD: 6,
  DIAMOND: 12,
};

function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // If we haven't reached `from`'s day-of-month yet this month, that
  // month doesn't fully count.
  return to.getDate() < from.getDate() ? months - 1 : months;
}

/**
 * `firstActivatedAt` is set once, the first time a subscription becomes
 * ACTIVE, and never touched again — deliberately NOT reset by a lapse and
 * resubscribe (ROADMAP.md Phase 16 open question #4 flagged this as
 * unconfirmed; "tenure persists" is the more generous, more standard
 * choice among subscription products, and errs toward not penalizing a
 * temporary lapse, so it's the default here pending explicit correction).
 */
export function tenureBadgeTier(firstActivatedAt: Date, now: Date = new Date()): TenureBadgeTier {
  const months = Math.max(0, monthsBetween(firstActivatedAt, now));
  let tier: TenureBadgeTier = "BRONZE";
  for (const candidate of TENURE_BADGE_TIERS) {
    if (months >= TIER_THRESHOLDS_MONTHS[candidate]) {
      tier = candidate;
    }
  }
  return tier;
}

export function tenureBadgeLabel(tier: TenureBadgeTier): string {
  switch (tier) {
    case "BRONZE":
      return "Plus Member";
    case "SILVER":
      return "Plus Member — Silver";
    case "GOLD":
      return "Plus Member — Gold";
    case "DIAMOND":
      return "Plus Member — Diamond";
    default:
      return "Plus Member";
  }
}
