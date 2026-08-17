import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACHIEVEMENT_CATALOG } from "@/features/achievements/lib/catalog";

const { prisma, writeAuditLog } = vi.hoisted(() => {
  const prisma = {
    achievement: { findMany: vi.fn(), upsert: vi.fn() },
    userAchievement: { findMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    tradeOffer: { count: vi.fn() },
    inventoryItem: { count: vi.fn() },
    shop: { findUnique: vi.fn() },
    order: { count: vi.fn() },
    productComment: { count: vi.fn() },
    post: { count: vi.fn() },
    userFollow: { count: vi.fn() },
    plusSubscription: { findFirst: vi.fn() },
  };
  return { prisma, writeAuditLog: vi.fn() };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/features/auth/services/audit-log.service", () => ({ writeAuditLog }));

import {
  evaluateAndGrantAchievements,
  listUserAchievements,
  syncAchievementCatalog,
} from "@/features/achievements/services/achievement.service";

function achievementRow(slug: string, overrides: Partial<Record<string, unknown>> = {}) {
  const entry = ACHIEVEMENT_CATALOG.find((row) => row.slug === slug)!;
  return { id: `id-${slug}`, ...entry, createdAt: new Date(), ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncAchievementCatalog", () => {
  it("upserts every catalog entry by slug", async () => {
    await syncAchievementCatalog();
    expect(prisma.achievement.upsert).toHaveBeenCalledTimes(ACHIEVEMENT_CATALOG.length);
    expect(prisma.achievement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "first-trade" } }),
    );
  });
});

describe("evaluateAndGrantAchievements", () => {
  it("grants an achievement whose criterion is newly satisfied and writes an audit log", async () => {
    prisma.achievement.findMany.mockResolvedValue([achievementRow("first-comment")]);
    prisma.userAchievement.findMany.mockResolvedValue([]);
    prisma.productComment.count.mockResolvedValue(1);
    prisma.userAchievement.create.mockResolvedValue({});

    const result = await evaluateAndGrantAchievements("user-1");

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("first-comment");
    expect(prisma.userAchievement.create).toHaveBeenCalledWith({
      data: { userId: "user-1", achievementId: "id-first-comment" },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        targetType: "Achievement",
        targetId: "id-first-comment",
      }),
    );
  });

  it("does not grant or re-check achievements the user already holds", async () => {
    prisma.achievement.findMany.mockResolvedValue([achievementRow("first-comment")]);
    prisma.userAchievement.findMany.mockResolvedValue([{ achievementId: "id-first-comment" }]);

    const result = await evaluateAndGrantAchievements("user-1");

    expect(result).toHaveLength(0);
    expect(prisma.productComment.count).not.toHaveBeenCalled();
    expect(prisma.userAchievement.create).not.toHaveBeenCalled();
  });

  it("does not grant an achievement whose criterion is unmet", async () => {
    prisma.achievement.findMany.mockResolvedValue([achievementRow("trade-veteran")]);
    prisma.userAchievement.findMany.mockResolvedValue([]);
    prisma.tradeOffer.count.mockResolvedValue(3);

    const result = await evaluateAndGrantAchievements("user-1");

    expect(result).toHaveLength(0);
    expect(prisma.userAchievement.create).not.toHaveBeenCalled();
  });

  it("swallows a unique-constraint race from a concurrent grant and continues", async () => {
    prisma.achievement.findMany.mockResolvedValue([achievementRow("first-comment")]);
    prisma.userAchievement.findMany.mockResolvedValue([]);
    prisma.productComment.count.mockResolvedValue(1);
    prisma.userAchievement.create.mockRejectedValue(new Error("Unique constraint failed"));

    const result = await evaluateAndGrantAchievements("user-1");

    expect(result).toHaveLength(0);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("grants relic-collector only once the user owns a Relic-rarity inventory item", async () => {
    prisma.achievement.findMany.mockResolvedValue([achievementRow("relic-collector")]);
    prisma.userAchievement.findMany.mockResolvedValue([]);
    prisma.inventoryItem.count.mockResolvedValue(1);
    prisma.userAchievement.create.mockResolvedValue({});

    const result = await evaluateAndGrantAchievements("user-1");

    expect(prisma.inventoryItem.count).toHaveBeenCalledWith({
      where: { ownerUserId: "user-1", rarity: "RELIC" },
    });
    expect(result).toHaveLength(1);
  });

  it("grants plus-veteran only once firstActivatedAt is over a year old", async () => {
    prisma.achievement.findMany.mockResolvedValue([achievementRow("plus-veteran")]);
    prisma.userAchievement.findMany.mockResolvedValue([]);
    prisma.plusSubscription.findFirst.mockResolvedValue({
      firstActivatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    prisma.userAchievement.create.mockResolvedValue({});

    const result = await evaluateAndGrantAchievements("user-1");

    expect(result).toHaveLength(0);
  });
});

describe("listUserAchievements", () => {
  it("maps unlocked rows to the public badge shape", async () => {
    const unlockedAt = new Date("2026-01-01T00:00:00.000Z");
    prisma.userAchievement.findMany.mockResolvedValue([
      { unlockedAt, achievement: achievementRow("shop-owner") },
    ]);

    const result = await listUserAchievements("user-1");

    expect(result).toEqual([
      expect.objectContaining({ slug: "shop-owner", unlockedAt }),
    ]);
  });
});
