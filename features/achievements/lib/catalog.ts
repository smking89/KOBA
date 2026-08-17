import type { AchievementCategory, ProductRarity } from "@/lib/generated/prisma/client";

/**
 * Source of truth for every earnable badge. Rows in the Achievement table
 * are upserted idempotently from this list by slug (see
 * syncAchievementCatalog in ../services/achievement.service) — this file,
 * not the database, is what you edit to add/change a badge.
 *
 * Every entry's unlock criteria must be computable from data KOBA already
 * tracks (see the matching evaluator in achievement.service.ts's
 * CRITERIA_EVALUATORS map, keyed by the same slug) and self-driven —
 * something the account holder themselves did, never a metric like
 * follower count that depends on other people's choices (client
 * correction, 2026-08-17: "the badges are not something that users
 * follow"). Badges are earned only — never purchased or gifted.
 *
 * Art style + scale (client direction, 2026-08-17): reference is
 * mezotv/discord-badges (MIT-licensed, see
 * public/brand/achievements/LICENSE-discord-badges.txt) — flat
 * color-gradient tiered badge art with a progressive-evolution motif per
 * category, not the earlier ornate gem/wings medal design. Five
 * categories reuse that repo's real tiered art directly (10-tier ladders
 * for account age, trade volume, and game variety; an 8-tier ladder for
 * KOBA Plus tenure; a 9-tier ladder for Boost rank) — everything else
 * without a matching real asset still renders through the procedural
 * hex-gem BadgeFrame. `image` points at the real asset when one exists;
 * `overlay: "koba-plus"` composites the real KOBA Plus mark on top (only
 * the Plus-tenure ladder — client, 2026-08-17: "some badges design need
 * koba plus logo created and used within the badge art just like
 * discord did there badges"). Streaming-tier badges are excluded — KOBA
 * doesn't support livestreaming yet.
 *
 * Difficulty now actually escalates with rarity (client correction,
 * 2026-08-17: "most of these are way too easy") — every 10-tier ladder
 * spreads 2 slugs per Common/Uncommon/Rare/Epic and 1 each at
 * Legendary/Relic, so the top tier is a genuine, rare achievement.
 *
 * Icon uniqueness rule: no lucide icon used here may also appear anywhere
 * in navigation (IconRail/AppSidebar/AppHeader/MobileNav), ProductActionRail,
 * or the homepage feature grid — even a visual lookalike (e.g. `Repeat`
 * next to `Repeat2`'s repost icon was rejected for exactly this).
 */
export type AchievementDefinition = {
  slug: string;
  name: string;
  description: string;
  rarity: ProductRarity;
  category: AchievementCategory;
  /** lucide-react icon name — only used when `image` is absent. */
  icon: string;
  /** Real badge art path under public/brand/achievements/, when one exists. */
  image?: string;
  /** Composites a second mark on top of `image`. Only "koba-plus" today. */
  overlay?: "koba-plus";
};

type LadderStep = { slug: string; name: string; image: string; threshold: number };

/**
 * Spreads `count` steps across the six rarity tiers, always ending at
 * RELIC for the hardest rung — pairs at Common/Uncommon/Rare/Epic first,
 * singles for the top two once there's no room left for more pairs. Used
 * instead of a single fixed-length RARITY_LADDER so an 8-rung ladder
 * (Plus tenure) and a 9-rung ladder (Boost rank) each get their own
 * correctly-sized spread instead of silently truncating/padding a
 * 10-item array.
 */
function raritySpread(count: number): ProductRarity[] {
  const tiers: ProductRarity[] = ["COMMON", "UNCOMMON", "RARE", "EPIC"];
  const singles = count >= 6 ? 2 : Math.max(0, count - tiers.length);
  const pairs = count - singles;
  const spread: ProductRarity[] = [];
  for (let i = 0; i < pairs; i++) {
    spread.push(tiers[Math.floor((i / pairs) * tiers.length)] ?? "EPIC");
  }
  if (singles === 2) spread.push("LEGENDARY", "RELIC");
  else if (singles === 1) spread.push("RELIC");
  return spread.slice(0, count);
}

// Populated as a side effect of buildLadder() calls below — the raw
// numeric threshold behind each ladder slug's description string, so
// achievement.service.ts's evaluators read the same number the catalog
// describes instead of a second hand-typed copy that could drift.
const ladderThresholds: Record<string, number> = {};

function buildLadder(
  steps: LadderStep[],
  {
    category,
    descriptionFor,
    overlay,
  }: {
    category: AchievementCategory;
    descriptionFor: (threshold: number) => string;
    overlay?: "koba-plus";
  },
): AchievementDefinition[] {
  const rarities = raritySpread(steps.length);
  return steps.map((step, index) => {
    ladderThresholds[step.slug] = step.threshold;
    return {
      slug: step.slug,
      name: step.name,
      description: descriptionFor(step.threshold),
      rarity: rarities[index] ?? "RELIC",
      category,
      icon: "Award", // unused when `image` is set — kept for type-shape consistency
      image: `/brand/achievements/${step.image}`,
      ...(overlay ? { overlay } : {}),
    };
  });
}

// --- ACCOUNT_AGE: real years-since-signup, same asset used since Phase 24 ---
const ACCOUNT_AGE_LADDER = buildLadder(
  [
    { slug: "account-age-1y", name: "Seed", image: "seed.svg", threshold: 1 },
    { slug: "account-age-2y", name: "Sprout", image: "sprout.svg", threshold: 2 },
    { slug: "account-age-3y", name: "Bud", image: "bud.svg", threshold: 3 },
    { slug: "account-age-4y", name: "Sapling", image: "sapling.svg", threshold: 4 },
    { slug: "account-age-5y", name: "Blossom", image: "blossom.svg", threshold: 5 },
    { slug: "account-age-6y", name: "Redwood", image: "redwood.svg", threshold: 6 },
    { slug: "account-age-7y", name: "Sequoia", image: "sequoia.svg", threshold: 7 },
    { slug: "account-age-8y", name: "Bristlecone", image: "bristlecone.svg", threshold: 8 },
    { slug: "account-age-9y", name: "Stromatolite", image: "stromatolite.svg", threshold: 9 },
    { slug: "account-age-10y", name: "Primordial", image: "primordial.svg", threshold: 10 },
  ],
  {
    category: "ACCOUNT_AGE",
    descriptionFor: (years) => `Been part of KOBA for ${years} year${years === 1 ? "" : "s"}.`,
  },
);

// --- TRADING: completed item trades, thresholds scaled for a marketplace
// (not "hours played") but keeping the same 10-rung shape/art as the
// reference's Game Time ladder ---
const TRADE_LADDER = buildLadder(
  [
    { slug: "trade-casual", name: "Casual Trader", image: "casual.svg", threshold: 1 },
    { slug: "trade-recreational", name: "Frequent Trader", image: "recreational.svg", threshold: 3 },
    { slug: "trade-dedicated", name: "Dedicated Trader", image: "dedicated.svg", threshold: 7 },
    { slug: "trade-committed", name: "Committed Trader", image: "committed.svg", threshold: 15 },
    { slug: "trade-serious", name: "Serious Trader", image: "serious.svg", threshold: 25 },
    { slug: "trade-devoted", name: "Devoted Trader", image: "devoted.svg", threshold: 40 },
    { slug: "trade-seasoned", name: "Seasoned Trader", image: "seasoned.svg", threshold: 60 },
    { slug: "trade-ironclad", name: "Ironclad Trader", image: "ironclad.svg", threshold: 90 },
    { slug: "trade-unshakeable", name: "Unshakeable Trader", image: "unshakeable.svg", threshold: 130 },
    { slug: "trade-eternal", name: "Eternal Trader", image: "eternal.svg", threshold: 200 },
  ],
  {
    category: "TRADING",
    descriptionFor: (n) => `Completed ${n} item trade${n === 1 ? "" : "s"}.`,
  },
);

// --- TRADING: distinct games owned across your inventory, thresholds
// scaled to KOBA's real game catalog size (see prisma/seed.ts) ---
const COLLECTOR_LADDER = buildLadder(
  [
    { slug: "collector-sampler", name: "Sampler", image: "sampler.svg", threshold: 2 },
    { slug: "collector-dabbler", name: "Dabbler", image: "dabbler.svg", threshold: 4 },
    { slug: "collector-enthusiast", name: "Enthusiast", image: "enthusiast.svg", threshold: 6 },
    { slug: "collector-ranger", name: "Ranger", image: "ranger.svg", threshold: 9 },
    { slug: "collector-explorer", name: "Explorer", image: "explorer.svg", threshold: 12 },
    { slug: "collector-adventurer", name: "Adventurer", image: "adventurer.svg", threshold: 16 },
    { slug: "collector-voyager", name: "Voyager", image: "voyager.svg", threshold: 20 },
    { slug: "collector-maverick", name: "Maverick", image: "maverick.svg", threshold: 26 },
    { slug: "collector-polymath", name: "Polymath", image: "polymath.svg", threshold: 34 },
    { slug: "collector-universalist", name: "Universalist", image: "universalist.svg", threshold: 44 },
  ],
  {
    category: "TRADING",
    descriptionFor: (n) => `Own items from ${n} different games.`,
  },
);

// --- MARKETPLACE: Boost rank, by lifetime Boosts purchased ---
const BOOST_LADDER = buildLadder(
  [
    { slug: "boost-rank-1", name: "Boost Rank I", image: "discord-boost-1.svg", threshold: 1 },
    { slug: "boost-rank-2", name: "Boost Rank II", image: "discord-boost-2.svg", threshold: 2 },
    { slug: "boost-rank-3", name: "Boost Rank III", image: "discord-boost-3.svg", threshold: 3 },
    { slug: "boost-rank-4", name: "Boost Rank IV", image: "discord-boost-4.svg", threshold: 5 },
    { slug: "boost-rank-5", name: "Boost Rank V", image: "discord-boost-5.svg", threshold: 8 },
    { slug: "boost-rank-6", name: "Boost Rank VI", image: "discord-boost-6.svg", threshold: 12 },
    { slug: "boost-rank-7", name: "Boost Rank VII", image: "discord-boost-7.svg", threshold: 18 },
    { slug: "boost-rank-8", name: "Boost Rank VIII", image: "discord-boost-8.svg", threshold: 25 },
    { slug: "boost-rank-9", name: "Boost Rank IX", image: "discord-boost-9.svg", threshold: 35 },
  ],
  {
    category: "MARKETPLACE",
    descriptionFor: (n) => `Purchased ${n} Boost${n === 1 ? "" : "s"} in total.`,
  },
);

// --- SPECIAL: KOBA Plus tenure, real Nitro-subscription-tier months
// thresholds from the reference repo, KOBA Plus mark composited on top ---
const PLUS_LADDER = buildLadder(
  [
    { slug: "plus-bronze", name: "KOBA Plus", image: "bronze.svg", threshold: 0 },
    { slug: "plus-silver", name: "KOBA Plus — Silver", image: "silver.svg", threshold: 3 },
    { slug: "plus-gold", name: "KOBA Plus — Gold", image: "gold.svg", threshold: 6 },
    { slug: "plus-platinum", name: "KOBA Plus — Platinum", image: "platinum.svg", threshold: 12 },
    { slug: "plus-diamond", name: "KOBA Plus — Diamond", image: "diamond.svg", threshold: 24 },
    { slug: "plus-emerald", name: "KOBA Plus — Emerald", image: "emerald.svg", threshold: 36 },
    { slug: "plus-ruby", name: "KOBA Plus — Ruby", image: "ruby.svg", threshold: 60 },
    { slug: "plus-opal", name: "KOBA Plus — Opal", image: "opal.svg", threshold: 72 },
  ],
  {
    category: "SPECIAL",
    descriptionFor: (months) =>
      months === 0
        ? "Active KOBA Plus subscriber."
        : `KOBA Plus subscriber for ${months}+ months.`,
    overlay: "koba-plus",
  },
);

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  ...ACCOUNT_AGE_LADDER,

  // --- TRADING (procedural, no matching real asset) ---
  ...TRADE_LADDER,
  ...COLLECTOR_LADDER,
  {
    slug: "relic-collector",
    name: "Relic Collector",
    description: "Owns a Relic-rarity item.",
    rarity: "RELIC",
    category: "TRADING",
    icon: "Gem",
  },

  // --- MARKETPLACE ---
  ...BOOST_LADDER,
  {
    slug: "shop-owner",
    name: "Shop Owner",
    description: "Opened a shop on KOBA.",
    rarity: "COMMON",
    category: "MARKETPLACE",
    icon: "Warehouse",
  },
  {
    slug: "first-sale",
    name: "First Sale",
    description: "Made your first sale.",
    rarity: "UNCOMMON",
    category: "MARKETPLACE",
    icon: "HandCoins",
  },
  {
    slug: "auction-winner",
    name: "Highest Bidder",
    description: "Won an auction.",
    rarity: "UNCOMMON",
    category: "MARKETPLACE",
    icon: "Gavel",
  },
  {
    slug: "verified-shop",
    name: "Verified Seller",
    description: "Your shop passed KOBA verification.",
    rarity: "RARE",
    category: "MARKETPLACE",
    icon: "BadgeCheck",
  },
  {
    slug: "auction-champion",
    name: "Auction Champion",
    description: "Won 5 auctions.",
    rarity: "RARE",
    category: "MARKETPLACE",
    icon: "Swords",
  },
  {
    slug: "big-spender",
    name: "Big Spender",
    description: "Spent $500 or more on the Marketplace.",
    rarity: "EPIC",
    category: "MARKETPLACE",
    icon: "Wallet",
  },
  {
    slug: "century-sales",
    name: "Storefront Staple",
    description: "Sold 100 orders from your shop.",
    rarity: "EPIC",
    category: "MARKETPLACE",
    icon: "TrendingUp",
  },
  {
    slug: "top-seller",
    name: "Top Seller",
    description: "Sold 500 orders from your shop.",
    rarity: "LEGENDARY",
    category: "MARKETPLACE",
    icon: "Landmark",
  },
  {
    slug: "whale",
    name: "Whale",
    description: "Purchased 10,000 or more KOBA Coins in total.",
    rarity: "LEGENDARY",
    category: "MARKETPLACE",
    icon: "Anchor",
  },

  // --- COMMUNITY (procedural, no matching real asset) ---
  {
    slug: "first-comment",
    name: "Conversation Starter",
    description: "Left your first comment on a product.",
    rarity: "COMMON",
    category: "COMMUNITY",
    icon: "Quote",
  },
  {
    slug: "critic",
    name: "Critic",
    description: "Wrote 10 shop reviews.",
    rarity: "UNCOMMON",
    category: "COMMUNITY",
    icon: "ClipboardCheck",
  },
  {
    slug: "social-butterfly",
    name: "Social Butterfly",
    description: "Published 25 posts.",
    rarity: "UNCOMMON",
    category: "COMMUNITY",
    icon: "Rss",
  },
  {
    slug: "prolific-poster",
    name: "Prolific Poster",
    description: "Published 100 posts.",
    rarity: "RARE",
    category: "COMMUNITY",
    icon: "Megaphone",
  },
  {
    slug: "trusted-seller",
    name: "Trusted Seller",
    description: "Shop holds a 4.5+ average rating across 10 or more reviews.",
    rarity: "EPIC",
    category: "COMMUNITY",
    icon: "ShieldCheck",
  },

  // --- SPECIAL ---
  ...PLUS_LADDER,
  {
    slug: "influencer-partner",
    name: "Influencer Partner",
    description: "Active KOBA Influencer partner.",
    rarity: "RARE",
    category: "SPECIAL",
    icon: "Radio",
  },
  {
    slug: "founding-member",
    name: "Founding Member",
    description: "Joined KOBA in its very first month.",
    rarity: "RELIC",
    category: "SPECIAL",
    icon: "Flag",
  },
];

export const ACHIEVEMENT_SLUGS = ACHIEVEMENT_CATALOG.map((entry) => entry.slug);

/** Raw numeric threshold behind every ladder-generated badge, keyed by slug. */
export const LADDER_THRESHOLDS: Readonly<Record<string, number>> = ladderThresholds;
