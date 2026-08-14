import { describe, expect, it } from "vitest";
import {
  SELLER_CREATE_STATUS,
  SELLER_SUBMIT_STATUS,
  canApproveListing,
  canCreateShop,
  canFollowOrReviewShop,
  canManageShop,
  canVerifyShop,
  isShopCommunityRole,
  slugify,
} from "@/features/shops/lib/access";
import { createShopSchema, upsertProductSchema } from "@/features/shops/schemas/shop.schemas";
import { isStaffAccountType } from "@/features/koba-id/lib/format";

describe("shop creation authorization", () => {
  it("lets a Business KOBAID open one shop", () => {
    expect(canCreateShop({ hasBusinessIdentity: true, alreadyOwnsShop: false })).toBe(true);
  });

  it("blocks players and second shops", () => {
    expect(canCreateShop({ hasBusinessIdentity: false, alreadyOwnsShop: false })).toBe(false);
    expect(canCreateShop({ hasBusinessIdentity: true, alreadyOwnsShop: true })).toBe(false);
  });
});

describe("shop community roles vs KOBA staff", () => {
  it("treats shop Owner/Moderator as community roles, not staff issuance", () => {
    expect(isShopCommunityRole("OWNER")).toBe(true);
    expect(isShopCommunityRole("MODERATOR")).toBe(true);
    expect(isShopCommunityRole("ADMIN")).toBe(false);
    expect(isShopCommunityRole("SUPERADMIN")).toBe(false);
  });

  it("does not let shop moderators verify shops or self-approve listings", () => {
    expect(canVerifyShop(["MODERATOR"])).toBe(false);
    expect(canVerifyShop(["ADMIN"])).toBe(true);
    expect(canVerifyShop(["SUPERADMIN"])).toBe(true);
    expect(canVerifyShop(["BUSINESS"])).toBe(false);
    expect(SELLER_CREATE_STATUS).toBe("DRAFT");
    expect(SELLER_SUBMIT_STATUS).toBe("PENDING");
    expect(SELLER_SUBMIT_STATUS).not.toBe("APPROVED");
    expect(canApproveListing(["BUSINESS"])).toBe(false);
    expect(canApproveListing(["PLAYER"])).toBe(false);
    expect(canApproveListing(["MODERATOR"])).toBe(true);
    expect(isStaffAccountType("MODERATOR")).toBe(true);
  });

  it("lets owners and shop members manage the shop", () => {
    expect(canManageShop({ userId: "owner", ownerUserId: "owner", memberUserIds: ["owner"] })).toBe(
      true,
    );
    expect(
      canManageShop({ userId: "mod", ownerUserId: "owner", memberUserIds: ["owner", "mod"] }),
    ).toBe(true);
    expect(
      canManageShop({ userId: "stranger", ownerUserId: "owner", memberUserIds: ["owner"] }),
    ).toBe(false);
  });
});

describe("follow and review", () => {
  it("blocks owners from following or reviewing their own shop", () => {
    expect(canFollowOrReviewShop({ userId: "owner", ownerUserId: "owner" })).toBe(false);
    expect(canFollowOrReviewShop({ userId: "player", ownerUserId: "owner" })).toBe(true);
  });
});

describe("shop schemas", () => {
  it("slugifies shop names", () => {
    expect(slugify("Ironwright Trading Co.")).toBe("ironwright-trading-co");
  });

  it("rejects short shop bios", () => {
    expect(createShopSchema.safeParse({ name: "A", bio: "short" }).success).toBe(false);
    expect(
      createShopSchema.safeParse({ name: "Ironwright", bio: "Monument kits for operators." })
        .success,
    ).toBe(true);
  });

  it("requires listing fields without an approved status", () => {
    const parsed = upsertProductSchema.safeParse({
      title: "Oxide kit",
      description: "A monument replacement kit.",
      rarity: "LEGENDARY",
      listingType: "FIXED",
      priceCents: 4600,
      inventoryQty: 1,
      gameSlug: "rust",
      categorySlug: "monuments",
      platforms: ["STEAM"],
    });
    expect(parsed.success).toBe(true);
    expect("moderationStatus" in (parsed.data ?? {})).toBe(false);
  });
});
