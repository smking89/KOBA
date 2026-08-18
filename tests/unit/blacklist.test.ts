import { describe, expect, it } from "vitest";
import { canManagePlatformBlacklist } from "@/features/blacklist/lib/access";
import { addShopBlacklistEntrySchema, addPlatformBlacklistEntrySchema } from "@/features/blacklist/schemas/blacklist.schemas";
import { paymentErrorStatus } from "@/features/payments/lib/errors";

describe("canManagePlatformBlacklist", () => {
  it("is true only for SUPERADMIN, never plain ADMIN/MODERATOR staff", () => {
    expect(canManagePlatformBlacklist(["SUPERADMIN"])).toBe(true);
    expect(canManagePlatformBlacklist(["ADMIN"])).toBe(false);
    expect(canManagePlatformBlacklist(["MODERATOR"])).toBe(false);
    expect(canManagePlatformBlacklist(["PLAYER"])).toBe(false);
    expect(canManagePlatformBlacklist([])).toBe(false);
  });
});

describe("addShopBlacklistEntrySchema", () => {
  it("accepts a minimal valid entry", () => {
    const result = addShopBlacklistEntrySchema.safeParse({
      targetUserId: "user_123",
      reason: "Chargeback fraud",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags).toEqual([]);
      expect(result.data.requestSocialRemoval).toBe(false);
    }
  });

  it("normalizes hashtags — strips a leading # and lowercases", () => {
    const result = addShopBlacklistEntrySchema.safeParse({
      targetUserId: "user_123",
      reason: "Repeat offender",
      hashtags: ["#Chargeback", "CHEATING"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags).toEqual(["chargeback", "cheating"]);
    }
  });

  it("rejects a hashtag with spaces or punctuation", () => {
    const result = addShopBlacklistEntrySchema.safeParse({
      targetUserId: "user_123",
      reason: "Repeat offender",
      hashtags: ["not a tag!"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a reason that's too short", () => {
    const result = addShopBlacklistEntrySchema.safeParse({
      targetUserId: "user_123",
      reason: "no",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const result = addShopBlacklistEntrySchema.safeParse({
      targetUserId: "user_123",
      reason: "Valid reason here",
      shopId: "should-not-be-here",
    });
    expect(result.success).toBe(false);
  });
});

describe("addPlatformBlacklistEntrySchema", () => {
  it("accepts a USER target", () => {
    const result = addPlatformBlacklistEntrySchema.safeParse({
      targetType: "USER",
      targetId: "user_123",
      reason: "Platform-wide fraud ring",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a SHOP target", () => {
    const result = addPlatformBlacklistEntrySchema.safeParse({
      targetType: "SHOP",
      targetId: "shop_123",
      reason: "Scam storefront",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid targetType", () => {
    const result = addPlatformBlacklistEntrySchema.safeParse({
      targetType: "GROUP",
      targetId: "x",
      reason: "Valid reason here",
    });
    expect(result.success).toBe(false);
  });
});

describe("paymentErrorStatus BLACKLISTED mapping", () => {
  it("maps to 403 Forbidden", () => {
    expect(paymentErrorStatus("BLACKLISTED")).toBe(403);
  });
});
