import { afterEach, describe, expect, it } from "vitest";
import { PLUS_BENEFITS, plusStateLabel } from "@/features/plus/lib/types";
import { approvedEntitlementCodes, isApprovedEntitlement } from "@/features/plus/lib/entitlements";
import { evaluateCheckoutEligibility, isEntitledState } from "@/features/plus/lib/policy";
import { assertApprovedPlanCode, findPlanConfig, plusPlanConfigs } from "@/features/plus/lib/plans";
import { PlusError } from "@/features/plus/lib/errors";
import { plusCheckoutSchema } from "@/features/plus/schemas/plus.schemas";
import { generatePlusRef } from "@/features/plus/lib/refs";
import {
  assertNoPlusSecrets,
  isPlusMetadata,
  mapStripeSubscriptionStatus,
  shouldApplyStripeEvent,
} from "@/features/plus/lib/stripe-map";
import {
  isAllowlistedPlusReturnPath,
  plusAppUrl,
  rejectArbitraryReturnUrl,
} from "@/features/plus/lib/return-urls";
import { plusNoStore } from "@/features/plus/lib/http";
import { isSensitivePath, prefersNetworkFirst } from "@/lib/pwa/sensitive-routes";
import { verifyStripeEvent } from "@/features/payments/lib/webhook-verify";
import { PaymentError } from "@/features/payments/lib/errors";
import Stripe from "stripe";

describe("plan lookup", () => {
  const previous = {
    monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY,
    annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
  };

  afterEach(() => {
    process.env.STRIPE_PRICE_PLUS_MONTHLY = previous.monthly;
    process.env.STRIPE_PRICE_PLUS_ANNUAL = previous.annual;
  });

  it("looks up monthly and annual plan codes", () => {
    process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_PLUS_ANNUAL = "price_annual_test";
    expect(findPlanConfig("KOBA_PLUS_MONTHLY")?.interval).toBe("MONTHLY");
    expect(findPlanConfig("KOBA_PLUS_ANNUAL")?.interval).toBe("ANNUAL");
    expect(plusPlanConfigs().map((plan) => plan.code)).toEqual([
      "KOBA_PLUS_MONTHLY",
      "KOBA_PLUS_ANNUAL",
    ]);
  });

  it("rejects unknown plan codes", () => {
    expect(() => assertApprovedPlanCode("price_from_browser")).toThrow(PlusError);
    expect(findPlanConfig("KOBA_PLUS_LIFETIME")).toBeUndefined();
  });

  it("does not treat placeholder env prices as configured", () => {
    process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_replace_me";
    expect(findPlanConfig("KOBA_PLUS_MONTHLY")?.stripePriceId).toBeNull();
  });
});

describe("checkout validation", () => {
  it("rejects client-controlled Price IDs and amounts", () => {
    expect(
      plusCheckoutSchema.safeParse({
        planCode: "KOBA_PLUS_MONTHLY",
        idempotencyKey: "idem-12345678",
        priceId: "price_from_browser",
      }).success,
    ).toBe(false);
    expect(
      plusCheckoutSchema.safeParse({
        planCode: "KOBA_PLUS_MONTHLY",
        idempotencyKey: "idem-12345678",
        amount: 1,
      }).success,
    ).toBe(false);
    expect(
      plusCheckoutSchema.safeParse({
        planCode: "KOBA_PLUS_MONTHLY",
        idempotencyKey: "idem-12345678",
      }).success,
    ).toBe(true);
  });

  it("requires an approved plan code", () => {
    expect(
      plusCheckoutSchema.safeParse({
        planCode: "price_1ABC",
        idempotencyKey: "idem-12345678",
      }).success,
    ).toBe(false);
  });
});

describe("checkout eligibility and ownership", () => {
  it("prevents duplicate active subscriptions", () => {
    expect(evaluateCheckoutEligibility({ state: "ACTIVE", stripeSubscriptionId: "sub_1" })).toBe(
      "duplicate",
    );
    expect(evaluateCheckoutEligibility({ state: "TRIALING", stripeSubscriptionId: "sub_1" })).toBe(
      "duplicate",
    );
  });

  it("sends past-due accounts to billing management", () => {
    expect(evaluateCheckoutEligibility({ state: "PAST_DUE", stripeSubscriptionId: "sub_1" })).toBe(
      "manage_billing",
    );
    expect(evaluateCheckoutEligibility({ state: "UNPAID", stripeSubscriptionId: "sub_1" })).toBe(
      "manage_billing",
    );
  });

  it("allows a new checkout after cancel/expiry on the same identity only", () => {
    expect(
      evaluateCheckoutEligibility({ state: "CANCELLED", stripeSubscriptionId: "sub_old" }),
    ).toBe("ok");
    expect(evaluateCheckoutEligibility({ state: "EXPIRED", stripeSubscriptionId: "sub_old" })).toBe(
      "ok",
    );
    expect(evaluateCheckoutEligibility(null)).toBe("ok");
  });
});

describe("entitlement policy", () => {
  const periodEnd = new Date(Date.now() + 86_400_000);

  it("entitles only approved states", () => {
    expect(isEntitledState("ACTIVE")).toBe(true);
    expect(
      isEntitledState("ACTIVE", { cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd }),
    ).toBe(true);
    expect(
      isEntitledState("ACTIVE", {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.now() - 1000),
      }),
    ).toBe(false);
    expect(isEntitledState("TRIALING")).toBe(false);
    expect(isEntitledState("PAST_DUE")).toBe(false);
    expect(isEntitledState("UNPAID")).toBe(false);
    expect(isEntitledState("INCOMPLETE")).toBe(false);
    expect(isEntitledState("PAUSED")).toBe(false);
    expect(isEntitledState("CANCELLED")).toBe(false);
    expect(isEntitledState("EXPIRED")).toBe(false);
    expect(isEntitledState("NONE")).toBe(false);
  });

  it("enables only the Plus badge by default", () => {
    expect(approvedEntitlementCodes()).toEqual(["PLUS_BADGE"]);
    expect(isApprovedEntitlement("PLUS_BADGE")).toBe(true);
    expect(isApprovedEntitlement("AIDEN_PRIORITY")).toBe(false);
    expect(isApprovedEntitlement("PROMOTIONAL_MONTHLY_COINS")).toBe(false);
    const security = PLUS_BENEFITS.find((benefit) => benefit.id === "security");
    expect(security?.free).toBe(true);
  });
});

describe("stripe mapping and event ordering", () => {
  it("maps Stripe statuses to internal states", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("TRIALING");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("UNPAID");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELLED");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("INCOMPLETE");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("EXPIRED");
    expect(mapStripeSubscriptionStatus("paused")).toBe("PAUSED");
  });

  it("ignores stale and out-of-order events", () => {
    expect(shouldApplyStripeEvent(100, 200)).toBe(false);
    expect(shouldApplyStripeEvent(200, 200)).toBe(true);
    expect(shouldApplyStripeEvent(201, 200)).toBe(true);
    expect(shouldApplyStripeEvent(50, null)).toBe(true);
  });

  it("recognises Plus metadata", () => {
    expect(isPlusMetadata({ kobaPlus: "1" })).toBe(true);
    expect(isPlusMetadata({ orderRef: "KOBA-ORD-1" })).toBe(false);
  });
});

describe("webhook signatures", () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
  });

  it("verifies a valid Stripe signature and rejects an invalid one", () => {
    const secret = "whsec_plus_test_secret_value";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const payload = JSON.stringify({
      id: "evt_plus_1",
      object: "event",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", object: "subscription" } },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = verifyStripeEvent(payload, header);
    expect(event.id).toBe("evt_plus_1");
    expect(() => verifyStripeEvent(payload, "t=1,v1=deadbeef")).toThrow(PaymentError);
    expect(() => verifyStripeEvent(payload, null)).toThrow(PaymentError);
  });
});

describe("return URLs and secrets", () => {
  it("allowlists Plus return paths and blocks open redirects", () => {
    expect(plusAppUrl("/plus?checkout=processing")).toContain("/plus?checkout=processing");
    expect(isAllowlistedPlusReturnPath("/plus")).toBe(true);
    expect(isAllowlistedPlusReturnPath("https://evil.example/plus")).toBe(false);
    expect(() => rejectArbitraryReturnUrl("https://evil.example/")).toThrow("OPEN_REDIRECT");
    expect(() => plusAppUrl("/orders/steal")).toThrow(/allowlisted/);
  });

  it("refuses secret fields in public payloads", () => {
    expect(() => assertNoPlusSecrets({ client_secret: "sec" })).toThrow(/secret/i);
    expect(() => assertNoPlusSecrets({ hosted_invoice_url: "https://in.stripe.com/x" })).toThrow();
    expect(() =>
      assertNoPlusSecrets({ publicRef: "KOBA-PLS-1", stripeSubscriptionId: "sub_1" }),
    ).not.toThrow();
  });
});

describe("API caching and labels", () => {
  it("marks Plus APIs no-store / network-only", () => {
    expect(plusNoStore["Cache-Control"]).toBe("no-store");
    expect(isSensitivePath("/api/plus")).toBe(true);
    expect(isSensitivePath("/api/plus/checkout")).toBe(true);
    expect(isSensitivePath("/api/plus/portal")).toBe(true);
    expect(prefersNetworkFirst("/plus")).toBe(true);
  });

  it("labels subscription states including cancel-at-period-end", () => {
    expect(plusStateLabel("ACTIVE")).toBe("Active");
    expect(plusStateLabel("PAST_DUE")).toBe("Past due");
    expect(plusStateLabel("CANCEL_AT_PERIOD_END")).toBe("Cancels at period end");
    expect(plusStateLabel("CANCELLED")).toBe("Cancelled");
    expect(plusStateLabel("EXPIRED")).toBe("Expired");
  });

  it("generates public Plus refs", () => {
    expect(generatePlusRef()).toMatch(/^KOBA-PLS-[0-9A-F]{8}$/);
  });
});
