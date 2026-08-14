import { afterEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { isSensitivePath, prefersNetworkFirst } from "@/lib/pwa/sensitive-routes";
import { PaymentError } from "@/features/payments/lib/errors";
import {
  canCheckoutListing,
  canPayReservedAuction,
  paidStatusFromClient,
  parseCommissionBps,
  splitPayment,
} from "@/features/payments/lib/money";
import { generateOrderRef } from "@/features/payments/lib/order-ref";
import { checkoutSchema } from "@/features/payments/schemas/checkout.schemas";
import { verifyStripeEvent } from "@/features/payments/lib/webhook-verify";

function bytesFromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(matches.map((part) => Number.parseInt(part, 16)));
}

describe("commission split", () => {
  it("takes 10% by default and leaves the rest for the seller", () => {
    expect(parseCommissionBps(undefined)).toBe(1000);
    expect(splitPayment(10_000, 1000)).toEqual({
      totalCents: 10_000,
      applicationFeeCents: 1000,
      sellerPayoutCents: 9000,
    });
  });

  it("rounds fees down but never takes more than the total", () => {
    expect(splitPayment(1, 1000)).toEqual({
      totalCents: 1,
      applicationFeeCents: 1,
      sellerPayoutCents: 0,
    });
    expect(splitPayment(0, 1000)).toEqual({
      totalCents: 0,
      applicationFeeCents: 0,
      sellerPayoutCents: 0,
    });
  });

  it("rejects out-of-range commission env and allows a zero fee", () => {
    expect(parseCommissionBps("99999")).toBe(1000);
    expect(parseCommissionBps("-1")).toBe(1000);
    expect(parseCommissionBps("0")).toBe(0);
    expect(splitPayment(5000, 0).applicationFeeCents).toBe(0);
  });
});

describe("checkout guards", () => {
  it("blocks the seller and shop members from buying their own listing", () => {
    expect(
      canCheckoutListing({
        buyerUserId: "owner",
        sellerUserId: "owner",
        shopMemberUserIds: ["owner"],
      }),
    ).toBe(false);
    expect(
      canCheckoutListing({
        buyerUserId: "mod",
        sellerUserId: "owner",
        shopMemberUserIds: ["owner", "mod"],
      }),
    ).toBe(false);
    expect(
      canCheckoutListing({
        buyerUserId: "player",
        sellerUserId: "owner",
        shopMemberUserIds: ["owner"],
      }),
    ).toBe(true);
  });

  it("lets only the reserved winner check out an auction", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const reservedUntil = new Date("2026-08-14T12:15:00.000Z");
    expect(
      canPayReservedAuction({
        buyerUserId: "winner",
        winnerUserId: "winner",
        status: "RESERVED",
        reservedUntil,
        now,
      }),
    ).toBe(true);
    expect(
      canPayReservedAuction({
        buyerUserId: "other",
        winnerUserId: "winner",
        status: "RESERVED",
        reservedUntil,
        now,
      }),
    ).toBe(false);
    expect(
      canPayReservedAuction({
        buyerUserId: "winner",
        winnerUserId: "winner",
        status: "LIVE",
        reservedUntil,
        now,
      }),
    ).toBe(false);
    expect(
      canPayReservedAuction({
        buyerUserId: "winner",
        winnerUserId: "winner",
        status: "RESERVED",
        reservedUntil,
        now: new Date("2026-08-14T12:16:00.000Z"),
      }),
    ).toBe(false);
  });

  it("ignores any client-supplied paid flag", () => {
    expect(paidStatusFromClient(true)).toBe("PENDING");
    expect(paidStatusFromClient({ paid: true })).toBe("PENDING");
    expect(paidStatusFromClient("PAID")).toBe("PENDING");
  });

  it("does not accept a paid field on the checkout payload", () => {
    const parsed = checkoutSchema.parse({
      slug: "oxide-furnace",
      quantity: 1,
      idempotencyKey: "idem-12345678",
      paid: true,
    });
    expect(parsed).toEqual({
      slug: "oxide-furnace",
      quantity: 1,
      idempotencyKey: "idem-12345678",
    });
    expect("paid" in parsed).toBe(false);
  });
});

describe("order references", () => {
  it("mints KOBA-ORD- plus 8 hex characters", () => {
    expect(generateOrderRef(() => bytesFromHex("deadbeef"))).toBe("KOBA-ORD-DEADBEEF");
  });
});

describe("webhook trust", () => {
  const original = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = original;
  });

  it("rejects unsigned and forged webhook bodies", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_unit_secret_value";
    expect(() => verifyStripeEvent("{}", null)).toThrow(PaymentError);
    expect(() => verifyStripeEvent("{}", "t=1,v1=deadbeef")).toThrow(PaymentError);
    try {
      verifyStripeEvent("{}", null);
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentError);
      if (error instanceof PaymentError) {
        expect(error.code).toBe("INVALID_SIGNATURE");
      }
    }
  });

  it("accepts a payload signed with the webhook secret", () => {
    const secret = "whsec_test_unit_secret_value";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const payload = JSON.stringify({
      id: "evt_test_1",
      object: "event",
      api_version: "2026-01-28.clover",
      created: 1,
      type: "ping",
      data: { object: {} },
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = verifyStripeEvent(payload, header);
    expect(event.id).toBe("evt_test_1");
  });
});

describe("payment routes", () => {
  it("protects buyer receipts", () => {
    expect(isProtectedPath("/orders")).toBe(true);
    expect(isProtectedPath("/orders/KOBA-ORD-DEADBEEF")).toBe(true);
  });

  it("never caches checkout or Stripe webhooks", () => {
    expect(isSensitivePath("/api/checkout")).toBe(true);
    expect(isSensitivePath("/api/stripe/webhook")).toBe(true);
    expect(prefersNetworkFirst("/orders")).toBe(true);
  });
});
