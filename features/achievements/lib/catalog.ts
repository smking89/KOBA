import type { AchievementCategory, ProductRarity } from "@/lib/generated/prisma/client";

/**
 * Source of truth for every earnable badge. Rows in the Achievement table
 * are upserted idempotently from this list by slug (see
 * syncAchievementCatalog in ../services/achievement.service) — this file,
 * not the database, is what you edit to add/change a badge.
 *
 * Every entry's unlock criteria must be computable from data KOBA already
 * tracks (see the matching evaluator in achievement.service.ts's
 * CRITERIA_EVALUATORS map, keyed by the same slug). Badges are earned only —
 * never purchased or gifted, per product spec.
 *
 * `rarity` reuses the exact six-tier marketplace rarity scale (and its
 * crest artwork/colors, see public/brand/rarity/*.png) as the badge tier
 * system. `icon` is a lucide-react icon component name rendered as a small
 * overlay glyph on top of the tier crest (see components/achievement-badge).
 */
export type AchievementDefinition = {
  slug: string;
  name: string;
  description: string;
  rarity: ProductRarity;
  category: AchievementCategory;
  icon: string;
};

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  // --- ACCOUNT_AGE: yearly tenure badges ---
  {
    slug: "account-age-1y",
    name: "First Anniversary",
    description: "Been part of KOBA for 1 year.",
    rarity: "COMMON",
    category: "ACCOUNT_AGE",
    icon: "Calendar",
  },
  {
    slug: "account-age-2y",
    name: "Two-Year Veteran",
    description: "Been part of KOBA for 2 years.",
    rarity: "UNCOMMON",
    category: "ACCOUNT_AGE",
    icon: "CalendarCheck",
  },
  {
    slug: "account-age-3y",
    name: "Three-Year Veteran",
    description: "Been part of KOBA for 3 years.",
    rarity: "RARE",
    category: "ACCOUNT_AGE",
    icon: "CalendarClock",
  },
  {
    slug: "account-age-5y",
    name: "Five-Year Legend",
    description: "Been part of KOBA for 5 years.",
    rarity: "EPIC",
    category: "ACCOUNT_AGE",
    icon: "CalendarHeart",
  },
  {
    slug: "account-age-10y",
    name: "Decade Club",
    description: "Been part of KOBA for 10 years.",
    rarity: "RELIC",
    category: "ACCOUNT_AGE",
    icon: "CalendarDays",
  },

  // --- TRADING ---
  {
    slug: "first-trade",
    name: "First Trade",
    description: "Completed your first item trade.",
    rarity: "COMMON",
    category: "TRADING",
    icon: "Handshake",
  },
  {
    slug: "trade-veteran",
    name: "Trade Veteran",
    description: "Completed 10 item trades.",
    rarity: "RARE",
    category: "TRADING",
    icon: "Repeat",
  },
  {
    slug: "trade-master",
    name: "Trade Master",
    description: "Completed 50 item trades.",
    rarity: "EPIC",
    category: "TRADING",
    icon: "Crown",
  },
  {
    slug: "relic-collector",
    name: "Relic Collector",
    description: "Owns a Relic-rarity item.",
    rarity: "RELIC",
    category: "TRADING",
    icon: "Gem",
  },

  // --- MARKETPLACE (selling) ---
  {
    slug: "shop-owner",
    name: "Shop Owner",
    description: "Opened a shop on KOBA.",
    rarity: "COMMON",
    category: "MARKETPLACE",
    icon: "Store",
  },
  {
    slug: "first-sale",
    name: "First Sale",
    description: "Made your first sale.",
    rarity: "UNCOMMON",
    category: "MARKETPLACE",
    icon: "ShoppingBag",
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
    slug: "fifty-sales",
    name: "Storefront Staple",
    description: "Sold 50 orders from your shop.",
    rarity: "EPIC",
    category: "MARKETPLACE",
    icon: "TrendingUp",
  },

  // --- COMMUNITY ---
  {
    slug: "first-comment",
    name: "Conversation Starter",
    description: "Left your first comment on a product.",
    rarity: "COMMON",
    category: "COMMUNITY",
    icon: "MessageCircle",
  },
  {
    slug: "social-butterfly",
    name: "Social Butterfly",
    description: "Published 25 posts.",
    rarity: "UNCOMMON",
    category: "COMMUNITY",
    icon: "Users",
  },
  {
    slug: "community-favorite",
    name: "Community Favorite",
    description: "Followed by 50 other players.",
    rarity: "RARE",
    category: "COMMUNITY",
    icon: "Heart",
  },

  // --- SPECIAL ---
  {
    slug: "plus-member",
    name: "KOBA Plus",
    description: "Active KOBA Plus subscriber.",
    rarity: "UNCOMMON",
    category: "SPECIAL",
    icon: "Sparkles",
  },
  {
    slug: "plus-veteran",
    name: "Plus Veteran",
    description: "KOBA Plus subscriber for over a year.",
    rarity: "LEGENDARY",
    category: "SPECIAL",
    icon: "Star",
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
