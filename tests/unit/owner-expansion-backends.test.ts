import { describe, expect, it } from "vitest";
import { sealSecret, openSecret } from "@/lib/crypto/secret-box";
import { sameRarityTier } from "@/features/trade/lib/types";
import { canConnectGameServer } from "@/features/servers/lib/types";
import { generateTradeRef } from "@/features/trade/lib/refs";
import { generateServerRef } from "@/features/servers/lib/refs";
import { generatePlusRef } from "@/features/plus/lib/refs";

describe("secret-box", () => {
  it("round-trips sealed secrets without exposing plaintext in the sealed payload", () => {
    const sealed = sealSecret("rcon-password-demo");
    expect(sealed.ciphertext).not.toContain("rcon-password-demo");
    expect(openSecret(sealed)).toBe("rcon-password-demo");
  });
});

describe("expansion backend contracts", () => {
  it("keeps trade rarity rule and role gates", () => {
    expect(sameRarityTier([{ rarity: "RARE" }], [{ rarity: "RARE" }])).toBe(true);
    expect(sameRarityTier([{ rarity: "RARE" }], [{ rarity: "EPIC" }])).toBe(false);
    expect(canConnectGameServer("BUSINESS")).toBe(true);
    expect(canConnectGameServer("PLAYER")).toBe(false);
  });

  it("generates public refs with expected prefixes", () => {
    expect(generateTradeRef()).toMatch(/^KOBA-TRD-/);
    expect(generateServerRef()).toMatch(/^KOBA-SRV-/);
    expect(generatePlusRef()).toMatch(/^KOBA-PLS-/);
  });
});
