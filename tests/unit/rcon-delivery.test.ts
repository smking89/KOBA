import { describe, expect, it } from "vitest";
import { upsertProductSchema } from "@/features/shops/schemas/shop.schemas";
import { checkoutSchema } from "@/features/payments/schemas/checkout.schemas";

const BASE_PRODUCT = {
  title: "Starter Kit",
  description: "A basic starter loadout for new players.",
  rarity: "COMMON" as const,
  listingType: "FIXED" as const,
  priceCents: 500,
  inventoryQty: 100,
  gameSlug: "rust",
  categorySlug: "kits",
  platforms: ["STEAM" as const],
  durationHours: 48,
  minIncrementCents: 1000,
};

describe("upsertProductSchema — direct-RCON auto-delivery fields", () => {
  it("accepts neither rconServerId nor rconKitName (manual fulfillment)", () => {
    expect(upsertProductSchema.safeParse(BASE_PRODUCT).success).toBe(true);
  });

  it("accepts both set together", () => {
    const result = upsertProductSchema.safeParse({
      ...BASE_PRODUCT,
      rconServerId: "my-rust-server",
      rconKitName: "starter_kit",
    });
    expect(result.success).toBe(true);
  });

  it("rejects rconServerId without rconKitName", () => {
    const result = upsertProductSchema.safeParse({
      ...BASE_PRODUCT,
      rconServerId: "my-rust-server",
    });
    expect(result.success).toBe(false);
  });

  it("rejects rconKitName without rconServerId", () => {
    const result = upsertProductSchema.safeParse({
      ...BASE_PRODUCT,
      rconKitName: "starter_kit",
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutSchema — buyerGameHandle", () => {
  it("is optional at the schema level (required-when-needed is checked in the service, not here)", () => {
    const result = checkoutSchema.safeParse({
      slug: "starter-kit",
      idempotencyKey: "idem-12345678",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a provided gamertag", () => {
    const result = checkoutSchema.safeParse({
      slug: "starter-kit",
      idempotencyKey: "idem-12345678",
      buyerGameHandle: "SomeGamertag",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.buyerGameHandle).toBe("SomeGamertag");
    }
  });
});
