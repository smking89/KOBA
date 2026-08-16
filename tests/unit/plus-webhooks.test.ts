import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const { prisma, stripe } = vi.hoisted(() => {
  const prisma = {
    processedStripeEvent: { create: vi.fn() },
    plusSubscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    subscriptionPlan: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    planEntitlement: { upsert: vi.fn(), findMany: vi.fn() },
    plusEntitlementGrant: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    shop: { updateMany: vi.fn() },
    order: { findFirst: vi.fn() },
  };
  const stripe = {
    subscriptions: { retrieve: vi.fn(), update: vi.fn() },
    checkout: { sessions: { retrieve: vi.fn(), create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    customers: { create: vi.fn() },
  };
  return { prisma, stripe };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/features/payments/lib/stripe", () => ({
  getStripe: () => stripe,
  isStripeConfigured: () => true,
}));
vi.mock("@/features/auth/services/audit-log.service", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("@/features/plus/services/plus-mail.service", () => ({
  notifyPlusPaymentFailed: vi.fn(),
}));
vi.mock("@/features/payments/services/checkout.service", () => ({
  expireCheckoutSession: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderRefunded: vi.fn(),
}));

import { handleStripeEvent } from "@/features/payments/services/webhook.service";
import { handlePlusStripeEvent } from "@/features/plus/services/plus-webhook.service";
import { syncSubscriptionFromStripe } from "@/features/plus/services/plus.service";
import { reconcilePlusSubscription } from "@/features/plus/services/plus-reconcile.service";

function plusSub(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_plus_1",
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    customer: "cus_1",
    metadata: {
      kobaPlus: "1",
      userId: "user_1",
      kobaIdentityId: "ident_player",
      accountType: "PLAYER",
      planCode: "KOBA_PLUS_MONTHLY",
    },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_267_200,
          price: { id: "price_monthly_test", object: "price" },
        } as Stripe.SubscriptionItem,
      ],
    } as Stripe.ApiList<Stripe.SubscriptionItem>,
    ...overrides,
  } as Stripe.Subscription;
}

describe("Plus webhook routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.processedStripeEvent.create.mockResolvedValue({ eventId: "evt" });
    prisma.plusSubscription.findUnique.mockResolvedValue(null);
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: "plan_monthly",
      interval: "MONTHLY",
    });
    prisma.plusSubscription.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "plus_1",
        publicRef: data.publicRef ?? "KOBA-PLS-TEST",
        ...data,
        version: 1,
      }),
    );
    prisma.plusSubscription.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "plus_1",
        publicRef: "KOBA-PLS-TEST",
        userId: "user_1",
        ...data,
      }),
    );
    stripe.subscriptions.retrieve.mockResolvedValue(plusSub());
  });

  it("treats a duplicate provider event as already processed", async () => {
    prisma.processedStripeEvent.create.mockRejectedValueOnce(new Error("unique"));
    await handleStripeEvent({
      id: "evt_dup",
      type: "customer.subscription.created",
      created: 10,
      data: { object: plusSub() },
    } as Stripe.Event);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("syncs subscription created and updated events", async () => {
    const created = await handlePlusStripeEvent({
      id: "evt_created",
      type: "customer.subscription.created",
      created: 20,
      data: { object: plusSub() },
    } as Stripe.Event);
    expect(created).toBe(true);

    prisma.plusSubscription.findUnique.mockResolvedValue({
      id: "plus_1",
      publicRef: "KOBA-PLS-TEST",
      userId: "user_1",
      kobaIdentityId: "ident_player",
      accountType: "PLAYER",
      lastStripeEventCreated: 20,
      state: "ACTIVE",
    });
    const updated = await handlePlusStripeEvent({
      id: "evt_updated",
      type: "customer.subscription.updated",
      created: 30,
      data: { object: plusSub({ cancel_at_period_end: true }) },
    } as Stripe.Event);
    expect(updated).toBe(true);
  });

  it("rejects stale webhook updates", async () => {
    const existing = {
      id: "plus_1",
      publicRef: "KOBA-PLS-TEST",
      userId: "user_1",
      kobaIdentityId: "ident_player",
      accountType: "PLAYER",
      lastStripeEventCreated: 500,
      state: "ACTIVE",
      planId: "plan_monthly",
    };
    prisma.plusSubscription.findUnique.mockResolvedValue(existing);
    const result = await syncSubscriptionFromStripe(plusSub({ status: "past_due" }), {
      source: "webhook",
      eventId: "evt_old",
      eventCreated: 100,
    });
    expect(result).toEqual(existing);
    expect(prisma.plusSubscription.update).not.toHaveBeenCalled();
  });

  it("applies cancellation at period end without dropping access in Stripe state", async () => {
    prisma.plusSubscription.findUnique.mockResolvedValue({
      id: "plus_1",
      publicRef: "KOBA-PLS-TEST",
      userId: "user_1",
      kobaIdentityId: "ident_player",
      accountType: "PLAYER",
      lastStripeEventCreated: 1,
      state: "ACTIVE",
    });
    await syncSubscriptionFromStripe(plusSub({ cancel_at_period_end: true }), {
      source: "webhook",
      eventId: "evt_cancel",
      eventCreated: 40,
    });
    expect(prisma.plusSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: "ACTIVE",
          cancelAtPeriodEnd: true,
        }),
      }),
    );
  });

  it("marks deleted subscriptions cancelled", async () => {
    await handlePlusStripeEvent({
      id: "evt_del",
      type: "customer.subscription.deleted",
      created: 50,
      data: { object: plusSub({ status: "canceled" }) },
    } as Stripe.Event);
    expect(prisma.plusSubscription.create).toHaveBeenCalled();
  });

  it("handles invoice paid and payment failed", async () => {
    prisma.plusSubscription.findUnique.mockResolvedValue({
      id: "plus_1",
      publicRef: "KOBA-PLS-TEST",
      userId: "user_1",
      stripeSubscriptionId: "sub_plus_1",
    });
    const paid = await handlePlusStripeEvent({
      id: "evt_paid",
      type: "invoice.paid",
      created: 60,
      data: { object: { id: "in_1", subscription: "sub_plus_1", metadata: { kobaPlus: "1" } } },
    } as unknown as Stripe.Event);
    expect(paid).toBe(true);

    stripe.subscriptions.retrieve.mockResolvedValueOnce(plusSub({ status: "past_due" }));
    const failed = await handlePlusStripeEvent({
      id: "evt_fail",
      type: "invoice.payment_failed",
      created: 70,
      data: { object: { id: "in_2", subscription: "sub_plus_1", metadata: { kobaPlus: "1" } } },
    } as unknown as Stripe.Event);
    expect(failed).toBe(true);
  });

  it("ignores marketplace checkout sessions", async () => {
    const handled = await handlePlusStripeEvent({
      id: "evt_order",
      type: "checkout.session.completed",
      created: 80,
      data: { object: { id: "cs_1", metadata: { orderRef: "KOBA-ORD-1" } } },
    } as unknown as Stripe.Event);
    expect(handled).toBe(false);
  });
});

describe("checkout isolation and idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.subscriptionPlan.upsert.mockResolvedValue({
      id: "plan_monthly",
      code: "KOBA_PLUS_MONTHLY",
      interval: "MONTHLY",
      stripePriceId: "price_monthly_test",
      active: true,
    });
    prisma.planEntitlement.upsert.mockResolvedValue({});
    prisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: "plan_monthly",
      code: "KOBA_PLUS_MONTHLY",
      interval: "MONTHLY",
      stripePriceId: "price_monthly_test",
      active: true,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "a@example.com",
      stripeCustomerId: "cus_1",
      profile: { activeAccountType: "PLAYER" },
      kobaIdentities: [
        { id: "ident_player", accountType: "PLAYER", code: "KOBA-P-1" },
        { id: "ident_biz", accountType: "BUSINESS", code: "KOBA-B-1" },
      ],
    });
    prisma.plusSubscription.findUnique.mockResolvedValue(null);
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/c/pay/cs_1",
    });
    prisma.plusSubscription.upsert = vi.fn().mockResolvedValue({ publicRef: "KOBA-PLS-TEST" });
    process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_monthly_test";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("binds checkout to the active KOBA account and reuses an open session", async () => {
    const { createPlusCheckout } = await import("@/features/plus/services/plus.service");
    const first = await createPlusCheckout("user_1", {
      planCode: "KOBA_PLUS_MONTHLY",
      idempotencyKey: "idem-aaaaaaaa",
    });
    expect(first.url).toContain("checkout.stripe.com");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ kobaIdentityId: "ident_player" }),
      }),
      expect.anything(),
    );

    prisma.plusSubscription.findUnique.mockResolvedValue({
      publicRef: "KOBA-PLS-TEST",
      state: "INCOMPLETE",
      stripeSubscriptionId: null,
      stripeCheckoutSessionId: "cs_open",
      checkoutIdempotencyKey: "idem-aaaaaaaa",
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_open",
      status: "open",
    });
    const reused = await createPlusCheckout("user_1", {
      planCode: "KOBA_PLUS_MONTHLY",
      idempotencyKey: "idem-aaaaaaaa",
    });
    expect(reused.url).toContain("cs_open");
  });

  it("does not let a Player subscription authorize a Business checkout", async () => {
    const { createPlusCheckout } = await import("@/features/plus/services/plus.service");
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "a@example.com",
      stripeCustomerId: "cus_1",
      profile: { activeAccountType: "BUSINESS" },
      kobaIdentities: [
        { id: "ident_player", accountType: "PLAYER", code: "KOBA-P-1" },
        { id: "ident_biz", accountType: "BUSINESS", code: "KOBA-B-1" },
      ],
    });
    prisma.plusSubscription.findUnique.mockImplementation(
      async ({ where }: { where: { kobaIdentityId?: string } }) => {
        if (where.kobaIdentityId === "ident_player") {
          return { state: "ACTIVE", stripeSubscriptionId: "sub_player" };
        }
        return null;
      },
    );
    await createPlusCheckout("user_1", {
      planCode: "KOBA_PLUS_MONTHLY",
      idempotencyKey: "idem-bbbbbbbb",
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ kobaIdentityId: "ident_biz", accountType: "BUSINESS" }),
      }),
      expect.anything(),
    );
  });
});

describe("portal and reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Customer Portal session against the platform customer", async () => {
    stripe.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p/session",
    });
    const { createBillingPortal } = await import("@/features/plus/services/plus.service");
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "a@example.com",
      stripeCustomerId: "cus_1",
      profile: { activeAccountType: "PLAYER" },
      kobaIdentities: [{ id: "ident_player", accountType: "PLAYER", code: "KOBA-P-1" }],
    });
    prisma.plusSubscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
    const result = await createBillingPortal("user_1");
    expect(result.url).toContain("billing.stripe.com");
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1" }),
    );
  });

  it("reconciles from Stripe and never sends local state to Stripe", async () => {
    prisma.plusSubscription.findUnique.mockResolvedValue({
      publicRef: "KOBA-PLS-TEST",
      stripeSubscriptionId: "sub_plus_1",
      state: "PAST_DUE",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      stripeCustomerId: "cus_1",
      userId: "user_1",
      kobaIdentityId: "ident_player",
      accountType: "PLAYER",
      lastStripeEventCreated: 1,
      plan: { code: "KOBA_PLUS_MONTHLY" },
    });
    stripe.subscriptions.retrieve.mockResolvedValue(plusSub());
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: "plan_monthly",
      interval: "MONTHLY",
    });
    prisma.plusSubscription.update.mockResolvedValue({
      publicRef: "KOBA-PLS-TEST",
      state: "ACTIVE",
      userId: "user_1",
    });
    const result = await reconcilePlusSubscription("KOBA-PLS-TEST", "staff_1");
    expect(result.publicRef).toBe("KOBA-PLS-TEST");
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });
});
