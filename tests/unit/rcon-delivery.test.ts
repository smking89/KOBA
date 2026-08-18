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

describe("checkoutSchema", () => {
  it("never accepts a client-supplied game handle — the buyer's already-linked", () => {
    // Client, 2026-08-18: identity linking happens ahead of time in
    // Settings, not typed in at checkout. checkoutSchema has no
    // buyerGameHandle field at all; createCheckoutSession resolves it
    // server-side from SteamAccountLink/XboxAccountLink/
    // PlayStationAccountLink via resolveGameHandleForPlatforms.
    const result = checkoutSchema.safeParse({
      slug: "starter-kit",
      idempotencyKey: "idem-12345678",
      buyerGameHandle: "SomeGamertag",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("buyerGameHandle" in result.data).toBe(false);
    }
  });
});
