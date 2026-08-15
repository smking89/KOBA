import { describe, expect, it } from "vitest";
import {
  buildCosmeticOrderBy,
  buildPublicCosmeticWhere,
} from "@/features/marketplace/lib/cosmetic-query";
import {
  cosmeticQuerySchema,
  parseCosmeticQuery,
  upsertCosmeticSchema,
} from "@/features/marketplace/schemas/cosmetic.schemas";
import { COSMETIC_SUB_TYPES } from "@/features/marketplace/lib/catalog";
import { isValidPromoPayoutValue } from "@/features/shops/services/promo.service";
import { promoConfigUpdateSchema } from "@/features/shops/schemas/shop.schemas";
import { rarityDistribution } from "@/features/shops/services/analytics.service";

describe("cosmetic sub-type enum", () => {
  it("is closed to exactly the subscription-perk catalog", () => {
    expect(COSMETIC_SUB_TYPES).toEqual([
      "AVATAR_DECORATION",
      "PROFILE_EFFECT",
      "NAMEPLATE",
      "PROFILE_FRAME",
      "SHOP_BANNER",
      "EMOJI",
    ]);
  });

  it("rejects an unknown sub-type", () => {
    const parsed = upsertCosmeticSchema.safeParse({
      name: "Neon halo",
      description: "A glowing avatar ring.",
      subType: "CUSTOM_BUILD",
      rarity: "EPIC",
      priceCents: 500,
    });
    expect(parsed.success).toBe(false);
  });

  it("has no custom-build fields — schema only accepts the closed field set", () => {
    const parsed = upsertCosmeticSchema.safeParse({
      name: "Neon halo",
      description: "A glowing avatar ring.",
      subType: "AVATAR_DECORATION",
      rarity: "EPIC",
      priceCents: 500,
      layers: ["not", "a", "real", "field"],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data && "layers" in parsed.data).toBe(false);
  });

  it("requires a minimum name and description length", () => {
    expect(
      upsertCosmeticSchema.safeParse({
        name: "A",
        description: "short",
        subType: "NAMEPLATE",
        rarity: "COMMON",
        priceCents: 0,
      }).success,
    ).toBe(false);
  });
});

describe("cosmetic query building", () => {
  it("only shows approved cosmetics publicly", () => {
    const where = buildPublicCosmeticWhere({ page: 1, pageSize: 12 });
    expect(where.moderationStatus).toBe("APPROVED");
  });

  it("filters by sub-type and rarity", () => {
    const where = buildPublicCosmeticWhere({
      subType: "NAMEPLATE",
      rarity: "RELIC",
      page: 1,
      pageSize: 12,
    });
    expect(where.subType).toBe("NAMEPLATE");
    expect(where.rarity).toBe("RELIC");
  });

  it("orders cosmetics newest first", () => {
    expect(buildCosmeticOrderBy()).toEqual({ createdAt: "desc" });
  });

  it("falls back to page 1 on invalid query input", () => {
    const parsed = parseCosmeticQuery({ subType: "hacked", page: "0" });
    expect(parsed.page).toBe(1);
    expect(parsed.subType).toBeUndefined();
  });

  it("caps page size", () => {
    expect(cosmeticQuerySchema.safeParse({ pageSize: 999 }).success).toBe(false);
  });
});

describe("promo payout value validation", () => {
  it("accepts basis points 0-10000 for PERCENT", () => {
    expect(isValidPromoPayoutValue("PERCENT", 0)).toBe(true);
    expect(isValidPromoPayoutValue("PERCENT", 10000)).toBe(true);
    expect(isValidPromoPayoutValue("PERCENT", 500)).toBe(true);
  });

  it("rejects PERCENT above 10000 basis points", () => {
    expect(isValidPromoPayoutValue("PERCENT", 10001)).toBe(false);
  });

  it("accepts any non-negative integer cents for FIXED", () => {
    expect(isValidPromoPayoutValue("FIXED", 0)).toBe(true);
    expect(isValidPromoPayoutValue("FIXED", 250_000)).toBe(true);
  });

  it("rejects negative or non-integer values for both types", () => {
    expect(isValidPromoPayoutValue("PERCENT", -1)).toBe(false);
    expect(isValidPromoPayoutValue("FIXED", -1)).toBe(false);
    expect(isValidPromoPayoutValue("PERCENT", 4.5)).toBe(false);
    expect(isValidPromoPayoutValue("FIXED", 4.5)).toBe(false);
  });

  it("the update schema rejects out-of-range PERCENT values", () => {
    expect(
      promoConfigUpdateSchema.safeParse({ payoutType: "PERCENT", payoutValue: 20000 }).success,
    ).toBe(false);
    expect(
      promoConfigUpdateSchema.safeParse({ payoutType: "PERCENT", payoutValue: 8000 }).success,
    ).toBe(true);
    expect(
      promoConfigUpdateSchema.safeParse({ payoutType: "FIXED", payoutValue: 20000 }).success,
    ).toBe(true);
  });
});

describe("rarity distribution (pure function)", () => {
  it("returns all zero for an empty catalog", () => {
    const distribution = rarityDistribution([]);
    expect(distribution.COMMON).toBe(0);
    expect(distribution.RELIC).toBe(0);
  });

  it("computes percentage breakdown that sums to ~100", () => {
    const distribution = rarityDistribution([
      { rarity: "COMMON" },
      { rarity: "COMMON" },
      { rarity: "RARE" },
      { rarity: "RELIC" },
    ]);
    expect(distribution.COMMON).toBe(50);
    expect(distribution.RARE).toBe(25);
    expect(distribution.RELIC).toBe(25);
    const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("handles a single-rarity catalog", () => {
    const distribution = rarityDistribution([{ rarity: "EPIC" }, { rarity: "EPIC" }]);
    expect(distribution.EPIC).toBe(100);
    expect(distribution.COMMON).toBe(0);
  });
});
