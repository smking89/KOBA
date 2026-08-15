import type Stripe from "stripe";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getPublicEnv } from "@/lib/env";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { PlusError } from "@/features/plus/lib/errors";
import { tenureBadgeLabel, tenureBadgeTier } from "@/features/plus/lib/tenure";
import type { PlusSubscriptionState, PlusSubscriptionView } from "@/features/plus/lib/types";

const PLUS_ENV_VAR = "STRIPE_PLUS_PRICE_ID";

function isPlaceholderPriceId(value: string | undefined): boolean {
  if (!value) return true;
  return value.includes("replace") || value.endsWith("_me");
}

function isPlusPriceConfigured(): boolean {
  return !isPlaceholderPriceId(process.env[PLUS_ENV_VAR]);
}

type SubscriptionRow = {
  state: PlusSubscriptionState;
  planId: string | null;
  renewsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  firstActivatedAt: Date | null;
};

function toView(row: SubscriptionRow): PlusSubscriptionView {
  const tier = row.firstActivatedAt ? tenureBadgeTier(row.firstActivatedAt) : null;
  return {
    state: row.state,
    planId: row.planId,
    renewsAt: row.renewsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    badgeVisible: row.state === "ACTIVE",
    tenureBadgeTier: tier,
    tenureBadgeLabel: tier ? tenureBadgeLabel(tier) : null,
  };
}

async function ensureSubscription(userId: string) {
  return prisma.plusSubscription.upsert({
    where: { userId },
    create: { userId, state: "NONE" },
    update: {},
  });
}

export async function getSubscription(userId: string): Promise<PlusSubscriptionView> {
  const sub = await ensureSubscription(userId);
  return toView(sub);
}

/** Whether userId currently has active Plus perks — the gate every perk
 * enforcement point (tenure badge display, per-server bio) calls. */
export async function isPlusActive(userId: string): Promise<boolean> {
  const sub = await prisma.plusSubscription.findUnique({ where: { userId } });
  return sub?.state === "ACTIVE";
}

/**
 * Real Stripe Checkout in subscription mode — a materially different
 * surface than every other Stripe flow in this codebase (one-off
 * Checkout Sessions for marketplace orders/Coin purchases). Fails closed
 * on both Stripe test-mode config AND the Plus price id specifically,
 * same two-layer check pattern as nothing else needs (marketplace/Coins
 * only ever needed the one Stripe config check).
 */
export async function createPlusCheckout(
  userId: string,
  idempotencyKey: string,
): Promise<{ url: string }> {
  if (!isStripeConfigured()) {
    throw new PlusError("Stripe test mode is not configured.", "INVALID");
  }
  if (!isPlusPriceConfigured()) {
    throw new PlusError(
      `KOBA Plus has no configured price (set ${PLUS_ENV_VAR} to enable).`,
      "INVALID",
    );
  }

  const sub = await ensureSubscription(userId);
  if (sub.state === "ACTIVE") {
    throw new PlusError("You already have an active Plus subscription.", "CONFLICT");
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const appUrl = getPublicEnv().appUrl;
  const stripe = getStripe();

  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      { ...(user?.email ? { email: user.email } : {}), metadata: { userId } },
      { idempotencyKey: `plus-customer:${userId}` },
    );
    customerId = customer.id;
  }

  const priceId = process.env[PLUS_ENV_VAR];
  if (!priceId) {
    throw new PlusError(`KOBA Plus has no configured price (set ${PLUS_ENV_VAR}).`, "INVALID");
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      success_url: `${appUrl}/plus?checkout=success`,
      cancel_url: `${appUrl}/plus?checkout=cancel`,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { kind: "plus_subscription", userId },
      subscription_data: { metadata: { userId } },
    },
    { idempotencyKey: `plus-checkout:${idempotencyKey}` },
  );

  await prisma.plusSubscription.update({
    where: { userId },
    data: { stripeCustomerId: customerId },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLUS_CHECKOUT_STARTED,
    targetType: "PlusSubscription",
    targetId: sub.id,
    metadata: { charged: false },
  });

  if (!session.url) {
    throw new PlusError("Stripe did not return a checkout URL.", "INVALID");
  }
  return { url: session.url };
}

/**
 * Cancels at period end (not immediately) — Plus perks stay active
 * through what's already been paid for, then the subscription lapses.
 * This is a deliberate default, not a guess left unflagged: ROADMAP.md
 * Phase 16 open question #4 asked whether cancellation is immediate or
 * has a grace period, and "runs out what you paid for" is the standard
 * subscription-product default, but it's still worth the client
 * confirming rather than assuming this is exactly what they want.
 */
export async function cancelSubscription(
  userId: string,
  ipAddress?: string | null,
): Promise<PlusSubscriptionView> {
  const sub = await ensureSubscription(userId);
  if (!sub.stripeSubscriptionId) {
    throw new PlusError("No active subscription to cancel.", "NOT_FOUND");
  }
  if (!isStripeConfigured()) {
    throw new PlusError("Stripe test mode is not configured.", "INVALID");
  }

  await getStripe().subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  const updated = await prisma.plusSubscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLUS_CANCELLED,
    targetType: "PlusSubscription",
    targetId: updated.id,
    metadata: { effectiveAt: updated.renewsAt },
    ipAddress: ipAddress ?? null,
  });

  return toView(updated);
}

function mapStripeStatus(status: Stripe.Subscription.Status): PlusSubscriptionState {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELLED";
    default:
      return "NONE";
  }
}

/**
 * Webhook-driven only — the source of truth for subscription state is
 * Stripe, never the checkout redirect. Handles customer.subscription.
 * created/updated/deleted. Idempotent: re-syncing the same Stripe state
 * twice is a no-op beyond the redundant write.
 */
export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    return;
  }

  const existing = await ensureSubscription(userId);
  const nextState = mapStripeStatus(subscription.status);
  // Stripe API versions matching this SDK (stripe@22.x) moved
  // current_period_end off the top-level Subscription object onto each
  // subscription item (a subscription can now have multiple prices with
  // independent billing periods) — Plus only ever has one item, so read
  // it from there. Falls back to the existing stored value if Stripe
  // ever omits it, rather than clobbering a known-good renewsAt with
  // null.
  const periodEndUnix = subscription.items.data[0]?.current_period_end;

  const becameActive = nextState === "ACTIVE" && existing.state !== "ACTIVE";

  const updated = await prisma.plusSubscription.update({
    where: { userId },
    data: {
      state: nextState,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      renewsAt: periodEndUnix ? new Date(periodEndUnix * 1000) : existing.renewsAt,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...(becameActive && !existing.firstActivatedAt ? { firstActivatedAt: new Date() } : {}),
    },
  });

  if (becameActive) {
    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.PLUS_ACTIVATED,
      targetType: "PlusSubscription",
      targetId: updated.id,
      metadata: { stripeSubscriptionId: subscription.id },
    });
  }
}

export async function markSubscriptionCancelled(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    return;
  }
  await ensureSubscription(userId);
  await prisma.plusSubscription.update({
    where: { userId },
    data: { state: "CANCELLED", cancelAtPeriodEnd: false },
  });
}
