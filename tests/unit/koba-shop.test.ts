import { describe, expect, it } from "vitest";
import { splitPayment } from "@/features/payments/lib/money";
import { KOBA_SHOP_COMMISSION_BPS } from "@/features/koba-shop/services/cosmetic-checkout.service";
import { kobaShopErrorStatus, KobaShopError } from "@/features/koba-shop/lib/errors";
import {
  cosmeticCheckoutSchema,
  equipCosmeticSchema,
  reviewApplicationSchema,
  unequipCosmeticSchema,
} from "@/features/koba-shop/schemas/koba-shop.schemas";

describe("KOBA_SHOP_COMMISSION_BPS", () => {
  it("is a flat 2.5%, distinct from the Blue-Badge-tiered marketplace rate", () => {
    expect(KOBA_SHOP_COMMISSION_BPS).toBe(250);
  });

  it("splitPayment takes exactly 2.5% of a cosmetic's price", () => {
    const split = splitPayment(10_000, KOBA_SHOP_COMMISSION_BPS);
    expect(split.applicationFeeCents).toBe(250);
    expect(split.sellerPayoutCents).toBe(9_750);
    expect(split.totalCents).toBe(10_000);
  });

  it("never charges a fee larger than the price itself on a tiny purchase", () => {
    const split = splitPayment(1, KOBA_SHOP_COMMISSION_BPS);
    expect(split.applicationFeeCents).toBeLessThanOrEqual(split.totalCents);
  });
});

describe("kobaShopErrorStatus", () => {
  it("maps REQUIRES_PLUS and FORBIDDEN to 403", () => {
    expect(kobaShopErrorStatus("REQUIRES_PLUS")).toBe(403);
    expect(kobaShopErrorStatus("FORBIDDEN")).toBe(403);
  });

  it("maps ALREADY_OWNED and CONFLICT to 409", () => {
    expect(kobaShopErrorStatus("ALREADY_OWNED")).toBe(409);
    expect(kobaShopErrorStatus("CONFLICT")).toBe(409);
  });

  it("maps NOT_FOUND to 404 and NOT_CONFIGURED to 503", () => {
    expect(kobaShopErrorStatus("NOT_FOUND")).toBe(404);
    expect(kobaShopErrorStatus("NOT_CONFIGURED")).toBe(503);
  });

  it("KobaShopError carries its code through", () => {
    const error = new KobaShopError("nope", "REQUIRES_PLUS");
    expect(error.code).toBe("REQUIRES_PLUS");
    expect(error.message).toBe("nope");
  });
});

describe("koba-shop schemas", () => {
  it("cosmeticCheckoutSchema requires a slug and idempotency key", () => {
    expect(cosmeticCheckoutSchema.safeParse({ slug: "x", idempotencyKey: "12345678" }).success).toBe(
      true,
    );
    expect(cosmeticCheckoutSchema.safeParse({ slug: "x" }).success).toBe(false);
  });

  it("reviewApplicationSchema only accepts APPROVED/REJECTED", () => {
    expect(reviewApplicationSchema.safeParse({ decision: "APPROVED" }).success).toBe(true);
    expect(reviewApplicationSchema.safeParse({ decision: "PENDING" }).success).toBe(false);
  });

  it("unequipCosmeticSchema rejects SHOP_BANNER (equips onto a shop, not a profile)", () => {
    expect(unequipCosmeticSchema.safeParse({ subType: "NAMEPLATE" }).success).toBe(true);
    expect(unequipCosmeticSchema.safeParse({ subType: "SHOP_BANNER" }).success).toBe(false);
  });

  it("equipCosmeticSchema requires a cosmeticOwnershipId", () => {
    expect(equipCosmeticSchema.safeParse({ cosmeticOwnershipId: "own_1" }).success).toBe(true);
    expect(equipCosmeticSchema.safeParse({}).success).toBe(false);
  });
});
