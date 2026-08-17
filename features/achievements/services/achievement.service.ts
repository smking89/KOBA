import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  ACHIEVEMENT_CATALOG,
  LADDER_THRESHOLDS,
  type AchievementDefinition,
} from "@/features/achievements/lib/catalog";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365 * MS_PER_DAY;
const MS_PER_MONTH = MS_PER_YEAR / 12;

// KOBA's first production migration (20250814120000_init) landed on
// 2025-08-14 — "founding member" is scoped to accounts created within 30
// days of that real launch date, not an arbitrary number.
const FOUNDING_WINDOW_END = new Date("2025-09-13T23:59:59.999Z");

function yearsSince(date: Date, years: number): boolean {
  return Date.now() - date.getTime() >= years * MS_PER_YEAR;
}

async function completedTradeCount(userId: string): Promise<number> {
  return prisma.tradeOffer.count({
    where: { state: "COMPLETED", OR: [{ proposerUserId: userId }, { counterpartyUserId: userId }] },
  });
}

async function distinctGamesOwned(userId: string): Promise<number> {
  const rows = await prisma.inventoryItem.findMany({
    where: { ownerUserId: userId },
    select: { game: true },
    distinct: ["game"],
  });
  return rows.length;
}

async function paidOrderCount(userId: string): Promise<number> {
  return prisma.order.count({
    where: { shop: { ownerUserId: userId }, status: { in: ["PAID", "FULFILLED"] } },
  });
}

async function boostCount(userId: string): Promise<number> {
  return prisma.boost.count({ where: { ownerUserId: userId } });
}

async function postCount(userId: string): Promise<number> {
  return prisma.post.count({ where: { authorUserId: userId } });
}

function ownedShop(userId: string) {
  return prisma.shop.findUnique({ where: { ownerUserId: userId }, select: { verificationStatus: true } });
}

/** Builds one evaluator per ladder slug from a shared count function and
 * that slug's real threshold (LADDER_THRESHOLDS, exported by catalog.ts
 * from the same ladder definitions the catalog itself is built from — the
 * number in the badge's description and the number that unlocks it can
 * never drift apart). */
function ladderEvaluators(
  slugs: string[],
  getCount: (userId: string) => Promise<number>,
): Record<string, (userId: string) => Promise<boolean>> {
  const evaluators: Record<string, (userId: string) => Promise<boolean>> = {};
  for (const slug of slugs) {
    const threshold = LADDER_THRESHOLDS[slug] ?? Infinity;
    evaluators[slug] = async (userId) => (await getCount(userId)) >= threshold;
  }
  return evaluators;
}

function slugsForPrefix(prefix: string): string[] {
  return ACHIEVEMENT_CATALOG.filter((entry) => entry.slug.startsWith(prefix)).map((entry) => entry.slug);
}

/**
 * One evaluator per catalog slug. Each takes the userId and returns whether
 * that user currently satisfies the badge's unlock criteria — every check
 * is a real query against data KOBA already tracks, nothing fabricated.
 * evaluateAndGrantAchievements runs the full map and grants any that are
 * newly satisfied and not already unlocked.
 */
const CRITERIA_EVALUATORS: Record<string, (userId: string) => Promise<boolean>> = {
  ...ladderEvaluators(slugsForPrefix("account-age-"), async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user) return 0;
    // yearsSince is a boolean threshold check, not a count — wrap it so it
    // slots into the generic >= comparator ladderEvaluators expects.
    for (let years = 10; years >= 1; years--) {
      if (yearsSince(user.createdAt, years)) return years;
    }
    return 0;
  }),
  ...ladderEvaluators(slugsForPrefix("trade-"), completedTradeCount),
  ...ladderEvaluators(slugsForPrefix("collector-"), distinctGamesOwned),
  ...ladderEvaluators(slugsForPrefix("boost-rank-"), boostCount),
  ...ladderEvaluators(slugsForPrefix("plus-"), async (userId) => {
    const sub = await prisma.plusSubscription.findFirst({
      where: { userId, state: "ACTIVE" },
      select: { firstActivatedAt: true },
    });
    if (!sub) return -1; // not an active subscriber at all — fails every tier, including the 0-month one
    if (!sub.firstActivatedAt) return 0; // active but tenure unknown — still clears the 0-month "just subscribed" tier
    return Math.floor((Date.now() - sub.firstActivatedAt.getTime()) / MS_PER_MONTH);
  }),

  "relic-collector": async (userId) => {
    const count = await prisma.inventoryItem.count({ where: { ownerUserId: userId, rarity: "RELIC" } });
    return count >= 1;
  },
  "shop-owner": async (userId) => !!(await ownedShop(userId)),
  "first-sale": async (userId) => (await paidOrderCount(userId)) >= 1,
  "auction-winner": async (userId) => {
    const count = await prisma.auction.count({ where: { winnerUserId: userId } });
    return count >= 1;
  },
  "verified-shop": async (userId) => (await ownedShop(userId))?.verificationStatus === "VERIFIED",
  "auction-champion": async (userId) => {
    const count = await prisma.auction.count({ where: { winnerUserId: userId } });
    return count >= 5;
  },
  "big-spender": async (userId) => {
    const result = await prisma.order.aggregate({
      where: { buyerUserId: userId, status: { in: ["PAID", "FULFILLED"] } },
      _sum: { totalCents: true },
    });
    return (result._sum.totalCents ?? 0) >= 50_000; // $500
  },
  "century-sales": async (userId) => (await paidOrderCount(userId)) >= 100,
  "top-seller": async (userId) => (await paidOrderCount(userId)) >= 500,
  "whale": async (userId) => {
    const result = await prisma.coinPurchase.aggregate({
      where: { userId, status: "PAID" },
      _sum: { coinAmount: true },
    });
    return (result._sum.coinAmount ?? 0n) >= 10_000n;
  },
  "first-comment": async (userId) => {
    const count = await prisma.productComment.count({ where: { authorUserId: userId } });
    return count >= 1;
  },
  "critic": async (userId) => {
    const count = await prisma.shopReview.count({ where: { authorUserId: userId } });
    return count >= 10;
  },
  "social-butterfly": async (userId) => (await postCount(userId)) >= 25,
  "prolific-poster": async (userId) => (await postCount(userId)) >= 100,
  "trusted-seller": async (userId) => {
    const shop = await prisma.shop.findUnique({
      where: { ownerUserId: userId },
      select: { reviews: { select: { rating: true } } },
    });
    if (!shop || shop.reviews.length < 10) return false;
    const avg = shop.reviews.reduce((sum, review) => sum + review.rating, 0) / shop.reviews.length;
    return avg >= 4.5;
  },
  "influencer-partner": async (userId) => {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId },
      select: { verificationStatus: true, suspendedAt: true },
    });
    return !!profile && profile.verificationStatus === "VERIFIED" && !profile.suspendedAt;
  },
  "founding-member": async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!user && user.createdAt <= FOUNDING_WINDOW_END;
  },
};

/**
 * Idempotently upserts the Achievement catalog rows from
 * ACHIEVEMENT_CATALOG by slug. Safe to call repeatedly (e.g. from a boot
 * hook or admin action) — existing rows are updated in place, nothing is
 * duplicated or deleted.
 */
export async function syncAchievementCatalog(): Promise<void> {
  for (const entry of ACHIEVEMENT_CATALOG) {
    await prisma.achievement.upsert({
      where: { slug: entry.slug },
      create: { slug: entry.slug, name: entry.name, description: entry.description, rarity: entry.rarity, category: entry.category, icon: entry.icon },
      update: {
        name: entry.name,
        description: entry.description,
        rarity: entry.rarity,
        category: entry.category,
        icon: entry.icon,
      },
    });
  }
}

function catalogEntry(slug: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_CATALOG.find((entry) => entry.slug === slug);
}

export type UnlockedAchievement = {
  slug: string;
  name: string;
  description: string;
  rarity: string;
  category: string;
  icon: string;
  image?: string;
  overlay?: "koba-plus";
};

/**
 * Checks every catalog criterion the user doesn't already hold and grants
 * any newly-satisfied ones, writing one ACHIEVEMENT_UNLOCKED audit entry per
 * grant. Returns the list of badges newly unlocked by this call (empty if
 * none) so the caller (profile self-view) can trigger a confetti moment.
 */
export async function evaluateAndGrantAchievements(userId: string): Promise<UnlockedAchievement[]> {
  const [catalog, alreadyUnlocked] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);
  const unlockedIds = new Set(alreadyUnlocked.map((row) => row.achievementId));
  const candidates = catalog.filter((achievement) => !unlockedIds.has(achievement.id));
  if (candidates.length === 0) return [];

  const newlyUnlocked: UnlockedAchievement[] = [];
  for (const achievement of candidates) {
    const evaluator = CRITERIA_EVALUATORS[achievement.slug];
    if (!evaluator) continue;
    const satisfied = await evaluator(userId);
    if (!satisfied) continue;

    try {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });
    } catch {
      // Unique constraint race (two concurrent evaluations) — already
      // granted by the other call, nothing further to do.
      continue;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.ACHIEVEMENT_UNLOCKED,
      targetType: "Achievement",
      targetId: achievement.id,
      metadata: { slug: achievement.slug, rarity: achievement.rarity },
    });

    const defined = catalogEntry(achievement.slug);
    newlyUnlocked.push({
      slug: achievement.slug,
      name: achievement.name,
      description: achievement.description,
      rarity: achievement.rarity,
      category: achievement.category,
      icon: achievement.icon,
      ...(defined?.image ? { image: defined.image } : {}),
      ...(defined?.overlay ? { overlay: defined.overlay } : {}),
    });
  }
  return newlyUnlocked;
}

export type UserBadge = {
  slug: string;
  name: string;
  description: string;
  rarity: string;
  category: string;
  icon: string;
  unlockedAt: Date;
  image?: string;
  overlay?: "koba-plus";
};

/** All badges a user currently holds, most-recently-unlocked first. */
export async function listUserAchievements(userId: string): Promise<UserBadge[]> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: "desc" },
  });
  return rows.map((row) => {
    const defined = catalogEntry(row.achievement.slug);
    return {
      slug: row.achievement.slug,
      name: row.achievement.name,
      description: row.achievement.description,
      rarity: row.achievement.rarity,
      category: row.achievement.category,
      icon: row.achievement.icon,
      unlockedAt: row.unlockedAt,
      ...(defined?.image ? { image: defined.image } : {}),
      ...(defined?.overlay ? { overlay: defined.overlay } : {}),
    };
  });
}
