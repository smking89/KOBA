import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { upsertProductSchema } from "@/features/shops/schemas/shop.schemas";
import { generatePluginApiKey, verifyPluginSignature } from "@/features/servers/lib/plugin-auth";

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

// Method B (client, 2026-08-18, KOBA-vs-Tip4Serv architecture spec):
// "All communication between KOBA and client servers must use HMAC
// SHA256 request signatures with unique, rotatable server API keys to
// prevent malicious command injection."
describe("plugin-auth — HMAC signature verification", () => {
  function sign(secret: string, timestamp: number, rawBody: string) {
    // Mirrors what a real plugin would compute — deliberately
    // reimplemented here rather than importing an internal helper, so
    // the test exercises the same contract an external plugin author
    // would follow from the header format alone.
    const hmac = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    return `t=${timestamp},v1=${hmac}`;
  }

  it("accepts a correctly signed request", () => {
    const generated = generatePluginApiKey();
    const now = Date.now();
    const header = sign(generated.secret, now, '{"success":true}');
    expect(
      verifyPluginSignature({
        sealed: generated.sealed,
        rawBody: '{"success":true}',
        header,
        now,
      }),
    ).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const generated = generatePluginApiKey();
    const wrongSecret = generatePluginApiKey().secret;
    const now = Date.now();
    const header = sign(wrongSecret, now, "{}");
    expect(verifyPluginSignature({ sealed: generated.sealed, rawBody: "{}", header, now })).toBe(
      false,
    );
  });

  it("rejects a stale timestamp outside the replay window", () => {
    const generated = generatePluginApiKey();
    const now = Date.now();
    const staleTimestamp = now - 10 * 60_000; // 10 minutes old
    const header = sign(generated.secret, staleTimestamp, "{}");
    expect(verifyPluginSignature({ sealed: generated.sealed, rawBody: "{}", header, now })).toBe(
      false,
    );
  });

  it("rejects a tampered body — the signature no longer matches", () => {
    const generated = generatePluginApiKey();
    const now = Date.now();
    const header = sign(generated.secret, now, '{"success":true}');
    expect(
      verifyPluginSignature({
        sealed: generated.sealed,
        rawBody: '{"success":false}', // body changed after signing
        header,
        now,
      }),
    ).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const generated = generatePluginApiKey();
    expect(
      verifyPluginSignature({ sealed: generated.sealed, rawBody: "{}", header: null }),
    ).toBe(false);
  });
});

describe("upsertProductSchema — SUBSCRIPTION listing fields", () => {
  it("rejects a SUBSCRIPTION listing missing grant/expiry/interval", () => {
    const result = upsertProductSchema.safeParse({ ...BASE_PRODUCT, listingType: "SUBSCRIPTION" });
    expect(result.success).toBe(false);
  });

  it("accepts a fully-configured SUBSCRIPTION listing", () => {
    const result = upsertProductSchema.safeParse({
      ...BASE_PRODUCT,
      listingType: "SUBSCRIPTION",
      rconServerId: "my-rust-server",
      rconKitName: "vip_grant",
      expiryKitName: "vip_revoke",
      subscriptionInterval: "MONTHLY",
    });
    expect(result.success).toBe(true);
  });

  it("a FIXED listing doesn't need subscription fields", () => {
    expect(upsertProductSchema.safeParse(BASE_PRODUCT).success).toBe(true);
  });
});
