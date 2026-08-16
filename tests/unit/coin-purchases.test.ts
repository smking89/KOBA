import { describe, expect, it } from "vitest";
import {
  COIN_PACKAGES,
  getCoinPackage,
  isCoinPackageConsistent,
  listCoinPackages,
} from "@/features/wallet/lib/coin-packages";
import { generateCoinPurchaseRef } from "@/features/wallet/lib/refs";
import { coinPurchaseSchema } from "@/features/wallet/lib/coin-purchase.schemas";

function bytesFromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(matches.map((part) => Number.parseInt(part, 16)));
}

describe("Coin package catalog", () => {
  it("finds a package by id and returns null for unknown ids", () => {
    expect(getCoinPackage("small")?.coinAmount).toBe(37n);
    expect(getCoinPackage("nonexistent")).toBeNull();
  });

  it("lists the full catalog", () => {
    expect(listCoinPackages()).toEqual(COIN_PACKAGES);
    expect(listCoinPackages().length).toBeGreaterThan(0);
  });

  it("every real package prices Coins within the sane band around the confirmed ~13-cent rate", () => {
    for (const pack of COIN_PACKAGES) {
      expect(isCoinPackageConsistent(pack)).toBe(true);
    }
  });

  it("rejects a package priced at or below KOBA's own cost basis", () => {
    expect(
      isCoinPackageConsistent({
        id: "bad",
        label: "Bad",
        priceCents: 1000,
        coinAmount: 1000n, // 1 cent/coin — below the 10-cent cost floor
      }),
    ).toBe(false);
  });

  it("rejects non-positive price or coin amounts", () => {
    expect(
      isCoinPackageConsistent({ id: "zero", label: "Zero", priceCents: 0, coinAmount: 100n }),
    ).toBe(false);
    expect(
      isCoinPackageConsistent({
        id: "zero-coins",
        label: "Zero Coins",
        priceCents: 100,
        coinAmount: 0n,
      }),
    ).toBe(false);
  });
});

describe("Coin purchase reference", () => {
  it("mints KOBA-CPR- plus 8 hex characters", () => {
    expect(generateCoinPurchaseRef(() => bytesFromHex("cafebabe"))).toBe("KOBA-CPR-CAFEBABE");
  });
});

describe("Coin purchase request schema", () => {
  it("accepts a valid package id and idempotency key", () => {
    const parsed = coinPurchaseSchema.parse({
      packageId: "starter",
      idempotencyKey: "idem-12345678",
    });
    expect(parsed).toEqual({ packageId: "starter", idempotencyKey: "idem-12345678" });
  });

  it("rejects an empty package id or a too-short idempotency key", () => {
    expect(
      coinPurchaseSchema.safeParse({ packageId: "", idempotencyKey: "idem-12345678" }).success,
    ).toBe(false);
    expect(
      coinPurchaseSchema.safeParse({ packageId: "starter", idempotencyKey: "short" }).success,
    ).toBe(false);
  });
});
