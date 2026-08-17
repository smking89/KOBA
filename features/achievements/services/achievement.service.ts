import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { ACHIEVEMENT_CATALOG } from "@/features/achievements/lib/catalog";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365 * MS_PER_DAY;

// KOBA's first production migration (20250814120000_init) landed on
// 2025-08-14 — "founding member" is scoped to accounts created within 30
// days of that real launch date, not an arbitrary number.
const FOUNDING_WINDOW_END = new Date("2025-09-13T23:59:59.999Z");

function yearsSince(date: Date, years: number): boolean {
  return Date.now() - date.getTime() >= years * MS_PER_YEAR;
}

/**
 * One evaluator per catalog slug. Each takes the userId and returns whether
 * that user currently satisfies the badge's unlock criteria — every check
 * is a real query against data KOBA already tracks, nothing fabricated.
 * evaluateAndGrantAchievements runs the full map and grants any that are
 * newly satisfied and not already unlocked.
 */
const CRITERIA_EVALUATORS: Record<string, (userId: string) => Promise<boolean>> = {
  "account-age-1y": async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!user && yearsSince(user.createdAt, 1);
  },
  "account-age-2y": async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!user && yearsSince(user.createdAt, 2);
  },
  "account-age-3y": async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!user && yearsSince(user.createdAt, 3);
  },
  "account-age-5y": async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!user && yearsSince(user.createdAt, 5);
  },
  "account-age-10y": async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!user && yearsSince(user.createdAt, 10);
  },
  "founding-member": async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!user && user.createdAt <= FOUNDING_WINDOW_END;
  },
  "first-trade": async (userId) => {
    const count = await prisma.tradeOffer.count({
      where: { state: "COMPLETED", OR: [{ proposerUserId: userId }, { counterpartyUserId: userId }] },
    });
    return count >= 1;
  },
  "trade-veteran": async (userId) => {
    const count = await prisma.tradeOffer.count({
      where: { state: "COMPLETED", OR: [{ proposerUserId: userId }, { counterpartyUserId: userId }] },
    });
    return count >= 10;
  },
  "trade-master": async (userId) => {
    const count = await prisma.tradeOffer.count({
      where: { state: "COMPLETED", OR: [{ proposerUserId: userId }, { counterpartyUserId: userId }] },
    });
    return count >= 50;
  },
  "relic-collector": async (userId) => {
    const count = await prisma.inventoryItem.count({ where: { ownerUserId: userId, rarity: "RELIC" } });
    return count >= 1;
  },
  "shop-owner": async (userId) => {
    const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId }, select: { id: true } });
    return !!shop;
  },
  "first-sale": async (userId) => {
    const count = await prisma.order.count({
      where: { shop: { ownerUserId: userId }, status: { in: ["PAID", "FULFILLED"] } },
    });
    return count >= 1;
  },
  "verified-shop": async (userId) => {
    const shop = await prisma.shop.findUnique({
      where: { ownerUserId: userId },
      select: { verificationStatus: true },
    });
    return shop?.verificationStatus === "VERIFIED";
  },
  "fifty-sales": async (userId) => {
    const count = await prisma.order.count({
      where: { shop: { ownerUserId: userId }, status: { in: ["PAID", "FULFILLED"] } },
    });
    return count >= 50;
  },
  "first-comment": async (userId) => {
    const count = await prisma.productComment.count({ where: { authorUserId: userId } });
    return count >= 1;
  },
  "social-butterfly": async (userId) => {
    const count = await prisma.post.count({ where: { authorUserId: userId } });
    return count >= 25;
  },
  "community-favorite": async (userId) => {
    const count = await prisma.userFollow.count({ where: { followingUserId: userId } });
    return count >= 50;
  },
  "plus-member": async (userId) => {
    const sub = await prisma.plusSubscription.findFirst({ where: { userId, state: "ACTIVE" } });
    return !!sub;
  },
  "plus-veteran": async (userId) => {
    const sub = await prisma.plusSubscription.findFirst({
      where: { userId, state: "ACTIVE", firstActivatedAt: { not: null } },
      select: { firstActivatedAt: true },
    });
    return !!sub?.firstActivatedAt && Date.now() - sub.firstActivatedAt.getTime() >= MS_PER_YEAR;
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
      create: entry,
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

export type UnlockedAchievement = {
  slug: string;
  name: string;
  description: string;
  rarity: string;
  category: string;
  icon: string;
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

    newlyUnlocked.push({
      slug: achievement.slug,
      name: achievement.name,
      description: achievement.description,
      rarity: achievement.rarity,
      category: achievement.category,
      icon: achievement.icon,
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
};

/** All badges a user currently holds, most-recently-unlocked first. */
export async function listUserAchievements(userId: string): Promise<UserBadge[]> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: "desc" },
  });
  return rows.map((row) => ({
    slug: row.achievement.slug,
    name: row.achievement.name,
    description: row.achievement.description,
    rarity: row.achievement.rarity,
    category: row.achievement.category,
    icon: row.achievement.icon,
    unlockedAt: row.unlockedAt,
  }));
}
