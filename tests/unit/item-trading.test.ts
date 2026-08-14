import { describe, expect, it } from "vitest";
import { assertSameRarityTrade, RARITY_VALUE_WARNING } from "@/features/trade/lib/rarity-policy";
import { nextTradeState, canActorPerform } from "@/features/trade/lib/state-machine";
import { resolveTradeFee } from "@/features/trade/lib/fee-policy";
import { sameRarityTier, tradeStateLabel } from "@/features/trade/lib/types";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

describe("rarity policy", () => {
  it("requires a single shared rarity tier", () => {
    expect(assertSameRarityTrade([{ rarity: "EPIC" }, { rarity: "EPIC" }])).toBe("EPIC");
    expect(() => assertSameRarityTrade([{ rarity: "EPIC" }, { rarity: "RARE" }])).toThrow(
      "MIXED_RARITY",
    );
    expect(sameRarityTier([{ rarity: "EPIC" }], [{ rarity: "EPIC" }])).toBe(true);
    expect(sameRarityTier([{ rarity: "EPIC" }], [{ rarity: "RARE" }])).toBe(false);
    expect(RARITY_VALUE_WARNING.toLowerCase()).toContain("market values");
  });
});

describe("trade state machine", () => {
  it("allows documented transitions only", () => {
    expect(nextTradeState("PENDING", "accept")).toBe("ACCEPTED");
    expect(nextTradeState("ACCEPTED", "complete")).toBe("COMPLETED");
    expect(nextTradeState("PENDING", "counter")).toBe("COUNTERED");
    expect(() => nextTradeState("COMPLETED", "accept")).toThrow(/INVALID_TRANSITION/);
    expect(canActorPerform("accept", "counterparty")).toBe(true);
    expect(canActorPerform("accept", "proposer")).toBe(false);
    expect(tradeStateLabel("VOIDED")).toBe("Voided");
  });
});

describe("trade fee policy", () => {
  it("defaults to zero fee", () => {
    expect(resolveTradeFee().flatFeeCoins).toBe(0n);
    expect(resolveTradeFee().enabled).toBe(false);
  });
});

describe("trade caching", () => {
  it("never caches trade or inventory APIs", () => {
    expect(isSensitivePath("/api/trade")).toBe(true);
    expect(isSensitivePath("/api/inventory/mine")).toBe(true);
  });
});
