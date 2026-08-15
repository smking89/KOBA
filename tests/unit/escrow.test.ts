import { afterEach, describe, expect, it } from "vitest";
import {
  canFlagDispute,
  canReleaseEscrow,
  canResolveDispute,
  computeEscrowReleaseAt,
  escrowHoldDays,
  parseEscrowHoldDays,
} from "@/features/payments/lib/escrow-rules";

describe("escrow hold window", () => {
  const previous = process.env.KOBA_ESCROW_HOLD_DAYS;

  afterEach(() => {
    process.env.KOBA_ESCROW_HOLD_DAYS = previous;
  });

  it("defaults to a 3 day hold", () => {
    delete process.env.KOBA_ESCROW_HOLD_DAYS;
    expect(parseEscrowHoldDays(undefined)).toBe(3);
    expect(escrowHoldDays()).toBe(3);
  });

  it("rejects out-of-range or garbage env values and falls back to default", () => {
    expect(parseEscrowHoldDays("-1")).toBe(3);
    expect(parseEscrowHoldDays("9999")).toBe(3);
    expect(parseEscrowHoldDays("not-a-number")).toBe(3);
    expect(parseEscrowHoldDays("0")).toBe(0);
    expect(parseEscrowHoldDays("30")).toBe(30);
  });

  it("respects a configured KOBA_ESCROW_HOLD_DAYS", () => {
    process.env.KOBA_ESCROW_HOLD_DAYS = "7";
    expect(escrowHoldDays()).toBe(7);
  });

  it("computes releaseAt as paidAt plus holdDays", () => {
    const paidAt = new Date("2026-08-14T12:00:00.000Z");
    expect(computeEscrowReleaseAt(paidAt, 3).toISOString()).toBe("2026-08-17T12:00:00.000Z");
    expect(computeEscrowReleaseAt(paidAt, 0).toISOString()).toBe(paidAt.toISOString());
  });
});

describe("canFlagDispute", () => {
  const releaseAt = new Date("2026-08-17T12:00:00.000Z");

  it("allows the buyer to dispute a still-holding escrow before release", () => {
    expect(
      canFlagDispute({
        buyerUserId: "buyer-1",
        orderBuyerUserId: "buyer-1",
        escrowStatus: "HOLDING",
        releaseAt,
        now: new Date("2026-08-15T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("rejects a non-buyer even if timing is otherwise fine", () => {
    expect(
      canFlagDispute({
        buyerUserId: "someone-else",
        orderBuyerUserId: "buyer-1",
        escrowStatus: "HOLDING",
        releaseAt,
        now: new Date("2026-08-15T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("rejects once escrow has already released (past the window)", () => {
    expect(
      canFlagDispute({
        buyerUserId: "buyer-1",
        orderBuyerUserId: "buyer-1",
        escrowStatus: "HOLDING",
        releaseAt,
        now: new Date("2026-08-18T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("rejects an escrow that is already disputed, released, or refunded", () => {
    for (const escrowStatus of ["DISPUTED", "RELEASED", "REFUNDED"]) {
      expect(
        canFlagDispute({
          buyerUserId: "buyer-1",
          orderBuyerUserId: "buyer-1",
          escrowStatus,
          releaseAt,
          now: new Date("2026-08-15T00:00:00.000Z"),
        }),
      ).toBe(false);
    }
  });
});

describe("canResolveDispute", () => {
  it("only permits resolution from DISPUTED", () => {
    expect(canResolveDispute({ escrowStatus: "DISPUTED" })).toBe(true);
    expect(canResolveDispute({ escrowStatus: "HOLDING" })).toBe(false);
    expect(canResolveDispute({ escrowStatus: "RELEASED" })).toBe(false);
    expect(canResolveDispute({ escrowStatus: "REFUNDED" })).toBe(false);
  });
});

describe("canReleaseEscrow", () => {
  it("only permits the auto-release sweep to act on HOLDING rows", () => {
    expect(canReleaseEscrow({ escrowStatus: "HOLDING" })).toBe(true);
    expect(canReleaseEscrow({ escrowStatus: "DISPUTED" })).toBe(false);
    expect(canReleaseEscrow({ escrowStatus: "RELEASED" })).toBe(false);
    expect(canReleaseEscrow({ escrowStatus: "REFUNDED" })).toBe(false);
  });
});
