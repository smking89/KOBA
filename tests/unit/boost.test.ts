import { describe, expect, it } from "vitest";
import { BOOST_COIN_COST, BOOST_DURATION_MS, BOOST_MULTIPLIER } from "@/features/boost/lib/pricing";
import { isBoostCurrentlyActive } from "@/features/boost/lib/state";

describe("boost pricing constants", () => {
  it("are positive and match the client-specified 10min/3x mechanic", () => {
    expect(BOOST_COIN_COST).toBeGreaterThan(0);
    expect(BOOST_DURATION_MS).toBe(10 * 60 * 1000);
    expect(BOOST_MULTIPLIER).toBe(3);
  });
});

describe("isBoostCurrentlyActive", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it("is false for an UNUSED boost regardless of expiresAt", () => {
    expect(
      isBoostCurrentlyActive(
        { status: "UNUSED", expiresAt: new Date("2026-08-15T12:05:00.000Z") },
        now,
      ),
    ).toBe(false);
  });

  it("is false for an APPLIED boost with no expiresAt (should not happen, but don't crash)", () => {
    expect(isBoostCurrentlyActive({ status: "APPLIED", expiresAt: null }, now)).toBe(false);
  });

  it("is true for an APPLIED boost whose expiresAt is in the future", () => {
    expect(
      isBoostCurrentlyActive(
        { status: "APPLIED", expiresAt: new Date("2026-08-15T12:05:00.000Z") },
        now,
      ),
    ).toBe(true);
  });

  it("is false for an APPLIED boost whose expiresAt has passed", () => {
    expect(
      isBoostCurrentlyActive(
        { status: "APPLIED", expiresAt: new Date("2026-08-15T11:55:00.000Z") },
        now,
      ),
    ).toBe(false);
  });

  it("is false for an EXPIRED boost even with a future expiresAt (status wins)", () => {
    expect(
      isBoostCurrentlyActive(
        { status: "EXPIRED", expiresAt: new Date("2026-08-15T12:05:00.000Z") },
        now,
      ),
    ).toBe(false);
  });

  it("accepts an ISO string for expiresAt (as sent from the API)", () => {
    expect(
      isBoostCurrentlyActive({ status: "APPLIED", expiresAt: "2026-08-15T12:05:00.000Z" }, now),
    ).toBe(true);
  });
});
