import { describe, expect, it } from "vitest";
import { parseCoinAmount, coinAmountToString } from "@/features/wallet/lib/amounts";
import {
  allocateSpend,
  DEFAULT_SPEND_ORDER,
  resolveSpendOrder,
} from "@/features/wallet/lib/spending-policy";
import { coinCategoryLabel } from "@/features/wallet/lib/types";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

describe("coin amounts", () => {
  it("accepts positive integers and rejects unsafe values", () => {
    expect(coinAmountToString(parseCoinAmount(40))).toBe("40");
    expect(coinAmountToString(parseCoinAmount("100"))).toBe("100");
    expect(coinAmountToString(parseCoinAmount(40n))).toBe("40");
    expect(() => parseCoinAmount(0)).toThrow();
    expect(() => parseCoinAmount(-1)).toThrow();
    expect(() => parseCoinAmount(1.5)).toThrow();
    expect(() => parseCoinAmount("01")).toThrow();
  });
});

describe("spending policy", () => {
  it("uses promotional → purchased → earned by default", () => {
    expect(resolveSpendOrder()).toEqual(DEFAULT_SPEND_ORDER);
    const allocations = allocateSpend(100n, {
      PROMOTIONAL: 40n,
      PURCHASED: 50n,
      EARNED: 100n,
    });
    expect(allocations).toEqual([
      { bucket: "PROMOTIONAL", amount: 40n },
      { bucket: "PURCHASED", amount: 50n },
      { bucket: "EARNED", amount: 10n },
    ]);
  });

  it("rejects insufficient funds", () => {
    expect(() => allocateSpend(10n, { PROMOTIONAL: 0n, PURCHASED: 0n, EARNED: 5n })).toThrow(
      "INSUFFICIENT",
    );
  });
});

describe("wallet surface contracts", () => {
  it("labels categories and never-caches wallet APIs", () => {
    expect(coinCategoryLabel("PROMOTIONAL_GRANT")).toBe("Promotional Grant");
    expect(isSensitivePath("/api/wallet")).toBe(true);
    expect(isSensitivePath("/api/wallet/transactions")).toBe(true);
  });
});
