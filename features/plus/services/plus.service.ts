import type Stripe from "stripe";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { PlusError } from "@/features/plus/lib/errors";
import {
  approvedEntitlementCodes,
  isApprovedEntitlement,
  type EntitlementCode,
} from "@/features/plus/lib/entitlements";
import { resolveActivePlusIdentity } from "@/features/plus/lib/identity";
import {
  assertApprovedPlanCode,
  findPlanConfig,
  formatDisplayPrice,
  plusPlanConfigs,
  type PlusPlanCode,
} from "@/features/plus/lib/plans";
import {
  displayState,
  evaluateCheckoutEligibility,
  isEntitledState,
} from "@/features/plus/lib/policy";
import { generatePlusRef } from "@/features/plus/lib/refs";
import { plusAppUrl } from "@/features/plus/lib/return-urls";
import {
  assertNoPlusSecrets,
  mapStripeSubscriptionStatus,
  periodFromStripeSubscription,
  priceIdFromStripeSubscription,
  shouldApplyStripeEvent,
} from "@/features/plus/lib/stripe-map";
import type { PlusSubscriptionState, PlusSubscriptionView } from "@/features/plus/lib/types";

type SubscriptionRow = {
  id: string;
  publicRef: string;
  userId: string;
  kobaIdentityId: string;
  accountType: string;
  planId: string | null;
  interval: PlusSubscriptionView["interval"];
  state: PlusSubscriptionState;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastStripeEventCreated: number | null;
  plan: { code: string; interval: NonNullable<PlusSubscriptionView["interval"]> } | null;
};

function entitledFromRow(row: {
  state: PlusSubscriptionState;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}): boolean {
  return isEntitledState(row.state, {
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
  });
}

export function toSubscriptionView(
  row: SubscriptionRow | null,
  extras?: { processing?: boolean; entitlements?: string[] },
): PlusSubscriptionView {
  if (!row) {
    return {
      publicRef: null,
      state: "NONE",
      displayState: "NONE",
      planCode: null,
      planId: null,
      interval: null,
      renewsAt: null,
      accessEndsAt: null,
      cancelAtPeriodEnd: false,
      badgeVisible: false,
      entitled: false,
      entitlements: extras?.entitlements ?? [],
      processing: extras?.processing ?? false,
      accountType: null,
      hasBillingCustomer: false,
    };
  }

  const entitled = entitledFromRow(row);
  const shown = displayState(row.state, row.cancelAtPeriodEnd);
  const periodEnd = row.currentPeriodEnd?.toISOString() ?? null;

  return {
    publicRef: row.publicRef,
    state: row.state,
    displayState: shown,
    planCode: row.plan?.code ?? null,
    planId: row.planId,
    interval: row.plan?.interval ?? row.interval,
    renewsAt: entitled && !row.cancelAtPeriodEnd ? periodEnd : null,
    accessEndsAt: row.cancelAtPeriodEnd || !entitled ? periodEnd : null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    badgeVisible: entitled && (extras?.entitlements ?? []).includes("PLUS_BADGE"),
    entitled,
    entitlements: extras?.entitlements ?? [],
    processing: extras?.processing ?? false,
    accountType: row.accountType,
    hasBillingCustomer: Boolean(row.stripeCustomerId),
  };
}

const subscriptionInclude = {
  plan: { select: { code: true, interval: true } },
} as const;

async function allocatePlusRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generatePlusRef();
    const clash = await prisma.plusSubscription.findUnique({ where: { publicRef } });
    if (!clash) return publicRef;
  }
  throw new PlusError("Could not allocate a Plus reference.", "CONFLICT");
}

export async function ensurePlans() {
  const configs = plusPlanConfigs();
  for (const config of configs) {
    const stripePriceId = config.stripePriceId ?? "unconfigured";
    const plan = await prisma.subscriptionPlan.upsert({
      where: { code: config.code },
      create: {
        code: config.code,
        displayName: config.displayName,
        interval: config.interval,
        stripePriceId,
        currency: config.currency,
        displayAmountCents: config.displayAmountCents,
        active: Boolean(config.stripePriceId),
        sortOrder: config.sortOrder,
        version: 1,
      },
      update: {
        displayName: config.displayName,
        interval: config.interval,
        stripePriceId,
        currency: config.currency,
        displayAmountCents: config.displayAmountCents,
        active: Boolean(config.stripePriceId),
        sortOrder: config.sortOrder,
      },
    });

    for (const code of approvedEntitlementCodes()) {
      await prisma.planEntitlement.upsert({
        where: { planId_code: { planId: plan.id, code } },
        create: { planId: plan.id, code, enabled: true, version: 1 },
        update: { enabled: true },
      });
    }
  }
}

async function loadIdentitySubscription(identityId: string) {
  return prisma.plusSubscription.findUnique({
    where: { kobaIdentityId: identityId },
    include: subscriptionInclude,
  });
}

async function activeGrantCodes(identityId: string, now = new Date()): Promise<string[]> {
  const grants = await prisma.plusEntitlementGrant.findMany({
    where: {
      kobaIdentityId: identityId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { code: true },
  });
  return grants.map((row) => row.code).filter(isApprovedEntitlement);
}

async function planEntitlementCodes(planId: string | null): Promise<string[]> {
  if (!planId) return [];
  const rows = await prisma.planEntitlement.findMany({
    where: { planId, enabled: true },
    select: { code: true },
  });
  return rows.map((row) => row.code).filter(isApprovedEntitlement);
}

export async function plusBadgeByIdentityIds(identityIds: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const id of identityIds) {
    result.set(id, false);
  }
  if (identityIds.length === 0) return result;
  const unique = [...new Set(identityIds)];
  await Promise.all(
    unique.map(async (id) => {
      result.set(id, await hasEntitlementForIdentity(id, "PLUS_BADGE"));
    }),
  );
  return result;
}

export async function entitlementsForIdentity(identityId: string): Promise<string[]> {
  const [sub, grants] = await Promise.all([
    loadIdentitySubscription(identityId),
    activeGrantCodes(identityId),
  ]);
  const fromPlan = sub && entitledFromRow(sub) ? await planEntitlementCodes(sub.planId) : [];
  return [...new Set([...fromPlan, ...grants])];
}

export async function hasEntitlementForIdentity(
  identityId: string,
  code: EntitlementCode | string,
): Promise<boolean> {
  if (!isApprovedEntitlement(code)) return false;
  const entitlements = await entitlementsForIdentity(identityId);
  return entitlements.includes(code);
}

export async function getAccountEntitlements(userId: string): Promise<string[]> {
  const identity = await resolveActivePlusIdentity(userId);
  return entitlementsForIdentity(identity.identityId);
}

export async function hasEntitlement(
  userId: string,
  code: EntitlementCode | string,
): Promise<boolean> {
  const identity = await resolveActivePlusIdentity(userId);
  return hasEntitlementForIdentity(identity.identityId, code);
}

export async function requireEntitlement(userId: string, code: EntitlementCode | string) {
  const ok = await hasEntitlement(userId, code);
  if (!ok) {
    throw new PlusError("KOBA Plus entitlement required.", "FORBIDDEN");
  }
}

export async function getSubscriptionStatus(userId: string): Promise<PlusSubscriptionView> {
  await ensurePlans();
  const identity = await resolveActivePlusIdentity(userId);
  const row = await loadIdentitySubscription(identity.identityId);
  const entitlements = await entitlementsForIdentity(identity.identityId);
  const processing = Boolean(
    row?.stripeCheckoutSessionId &&
    (row.state === "NONE" || row.state === "INCOMPLETE") &&
    !entitledFromRow(row),
  );
  return toSubscriptionView(row, { entitlements, processing });
}

/** @deprecated Use getSubscriptionStatus — kept for existing callers. */
export async function getSubscription(userId: string): Promise<PlusSubscriptionView> {
  return getSubscriptionStatus(userId);
}

export async function getPlanComparison() {
  await ensurePlans();
  const plans = await prisma.subscriptionPlan.findMany({
    where: { code: { in: ["KOBA_PLUS_MONTHLY", "KOBA_PLUS_ANNUAL"] } },
    include: { entitlements: true },
    orderBy: { sortOrder: "asc" },
  });

  return plans.map((plan) => {
    const config = findPlanConfig(plan.code);
    return {
      code: plan.code,
      displayName: plan.displayName,
      interval: plan.interval,
      currency: plan.currency,
      displayAmountCents: plan.displayAmountCents,
      priceLabel: formatDisplayPrice(plan.displayAmountCents, plan.currency, plan.interval),
      active: plan.active && Boolean(config?.stripePriceId),
      configured: Boolean(config?.stripePriceId),
      entitlements: plan.entitlements
        .filter((row) => row.enabled && isApprovedEntitlement(row.code))
        .map((row) => row.code),
    };
  });
}

async function getOrCreateStripeCustomer(identity: {
  userId: string;
  identityId: string;
  accountType: string;
  email: string | null;
  stripeCustomerId: string | null;
}): Promise<string> {
  const stripe = getStripe();
  if (identity.stripeCustomerId) {
    return identity.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    ...(identity.email ? { email: identity.email } : {}),
    metadata: {
      kobaPlus: "1",
      userId: identity.userId,
    },
  });

  await prisma.user.update({
    where: { id: identity.userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

async function reuseOpenCheckout(sessionId: string): Promise<string | null> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.url && session.status !== "expired" && session.status !== "complete") {
    return session.url;
  }
  return null;
}

export async function createPlusCheckout(
  userId: string,
  input: { planCode: string; idempotencyKey: string },
  ipAddress?: string | null,
): Promise<{ url: string; publicRef: string; processing: true }> {
  if (!isStripeConfigured()) {
    throw new PlusError(
      "Stripe test mode is not configured. Add sk_test_ keys to continue.",
      "NOT_CONFIGURED",
    );
  }

  const planCode = assertApprovedPlanCode(input.planCode);
  const config = findPlanConfig(planCode);
  if (!config?.stripePriceId) {
    throw new PlusError("This Plus plan is not configured for test checkout.", "NOT_CONFIGURED");
  }

  await ensurePlans();
  const identity = await resolveActivePlusIdentity(userId);
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
  if (!plan?.active || plan.stripePriceId === "unconfigured") {
    throw new PlusError("This Plus plan is not available.", "INVALID");
  }

  const existing = await loadIdentitySubscription(identity.identityId);
  const eligibility = evaluateCheckoutEligibility(existing);
  if (eligibility === "manage_billing") {
    throw new PlusError("Update billing for the existing subscription instead.", "CONFLICT");
  }
  if (eligibility === "duplicate") {
    throw new PlusError("This KOBA account already has KOBA Plus.", "CONFLICT");
  }

  if (
    existing?.checkoutIdempotencyKey === input.idempotencyKey &&
    existing.stripeCheckoutSessionId
  ) {
    const reused = await reuseOpenCheckout(existing.stripeCheckoutSessionId);
    if (reused) {
      return { url: reused, publicRef: existing.publicRef, processing: true };
    }
  }

  if (existing?.stripeCheckoutSessionId) {
    const reused = await reuseOpenCheckout(existing.stripeCheckoutSessionId);
    if (reused) {
      return { url: reused, publicRef: existing.publicRef, processing: true };
    }
  }

  const customerId = await getOrCreateStripeCustomer(identity);
  const publicRef = existing?.publicRef ?? (await allocatePlusRef());
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: publicRef,
      success_url: plusAppUrl("/plus?checkout=processing"),
      cancel_url: plusAppUrl("/plus?checkout=cancelled"),
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: {
        kobaPlus: "1",
        userId: identity.userId,
        kobaIdentityId: identity.identityId,
        accountType: identity.accountType,
        planCode,
      },
      subscription_data: {
        metadata: {
          kobaPlus: "1",
          userId: identity.userId,
          kobaIdentityId: identity.identityId,
          accountType: identity.accountType,
          planCode,
        },
      },
    },
    { idempotencyKey: `plus-checkout:${identity.identityId}:${input.idempotencyKey}` },
  );

  if (!session.url) {
    throw new PlusError("Stripe did not return a checkout URL.", "INVALID");
  }

  await prisma.plusSubscription.upsert({
    where: { kobaIdentityId: identity.identityId },
    create: {
      publicRef,
      userId: identity.userId,
      kobaIdentityId: identity.identityId,
      accountType: identity.accountType,
      planId: plan.id,
      interval: plan.interval,
      provider: "stripe",
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
      checkoutIdempotencyKey: input.idempotencyKey,
      state: "INCOMPLETE",
    },
    update: {
      planId: plan.id,
      interval: plan.interval,
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
      checkoutIdempotencyKey: input.idempotencyKey,
      state: existing?.state === "ACTIVE" ? existing.state : "INCOMPLETE",
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLUS_CHECKOUT_STARTED,
    targetType: "PlusSubscription",
    targetId: publicRef,
    metadata: { planCode, publicRef, charged: false },
    ipAddress: ipAddress ?? null,
  });

  return { url: session.url, publicRef, processing: true };
}

export async function createBillingPortal(userId: string): Promise<{ url: string }> {
  if (!isStripeConfigured()) {
    throw new PlusError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }
  const identity = await resolveActivePlusIdentity(userId);
  const customerId =
    identity.stripeCustomerId ??
    (await loadIdentitySubscription(identity.identityId))?.stripeCustomerId;
  if (!customerId) {
    throw new PlusError("No billing customer exists for this account.", "NOT_FOUND");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: plusAppUrl("/plus"),
  });

  return { url: session.url };
}

export async function cancelAtPeriodEnd(
  userId: string,
  idempotencyKey: string,
  ipAddress?: string | null,
): Promise<PlusSubscriptionView> {
  if (!isStripeConfigured()) {
    throw new PlusError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }
  const identity = await resolveActivePlusIdentity(userId);
  const existing = await loadIdentitySubscription(identity.identityId);
  if (!existing?.stripeSubscriptionId || !entitledFromRow(existing)) {
    throw new PlusError("No active Plus subscription to cancel.", "NOT_FOUND");
  }

  const updated = await getStripe().subscriptions.update(
    existing.stripeSubscriptionId,
    { cancel_at_period_end: true },
    { idempotencyKey: `plus-cancel:${existing.id}:${idempotencyKey}` },
  );

  await syncSubscriptionFromStripe(updated, { source: "api" });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLUS_CANCELLED,
    targetType: "PlusSubscription",
    targetId: existing.publicRef,
    metadata: { publicRef: existing.publicRef, cancelAtPeriodEnd: true },
    ipAddress: ipAddress ?? null,
  });

  return getSubscriptionStatus(userId);
}

export async function reactivateSubscription(
  userId: string,
  idempotencyKey: string,
  ipAddress?: string | null,
): Promise<PlusSubscriptionView> {
  if (!isStripeConfigured()) {
    throw new PlusError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }
  const identity = await resolveActivePlusIdentity(userId);
  const existing = await loadIdentitySubscription(identity.identityId);
  if (!existing?.stripeSubscriptionId || !existing.cancelAtPeriodEnd) {
    throw new PlusError("There is no scheduled cancellation to undo.", "INVALID");
  }
  if (!entitledFromRow(existing)) {
    throw new PlusError("This subscription can no longer be reactivated.", "INVALID");
  }

  const updated = await getStripe().subscriptions.update(
    existing.stripeSubscriptionId,
    { cancel_at_period_end: false },
    { idempotencyKey: `plus-reactivate:${existing.id}:${idempotencyKey}` },
  );

  await syncSubscriptionFromStripe(updated, { source: "api" });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLUS_UPDATED,
    targetType: "PlusSubscription",
    targetId: existing.publicRef,
    metadata: { publicRef: existing.publicRef, reactivated: true },
    ipAddress: ipAddress ?? null,
  });

  return getSubscriptionStatus(userId);
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  opts?: {
    source?: "webhook" | "api" | "reconcile";
    eventId?: string;
    eventCreated?: number;
    checkoutSessionId?: string;
  },
) {
  const source = opts?.source ?? "webhook";
  const metadata = subscription.metadata ?? {};
  const identityId = metadata.kobaIdentityId;
  const existing = subscription.id
    ? await prisma.plusSubscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
        include: subscriptionInclude,
      })
    : null;

  const byIdentity =
    existing ??
    (identityId
      ? await prisma.plusSubscription.findUnique({
          where: { kobaIdentityId: identityId },
          include: subscriptionInclude,
        })
      : null);

  if (!byIdentity && !identityId) {
    return null;
  }

  if (
    source === "webhook" &&
    !shouldApplyStripeEvent(opts?.eventCreated, byIdentity?.lastStripeEventCreated)
  ) {
    return byIdentity;
  }

  const state = mapStripeSubscriptionStatus(subscription.status);
  const period = periodFromStripeSubscription(subscription);
  const priceId = priceIdFromStripeSubscription(subscription);
  const plan = priceId
    ? await prisma.subscriptionPlan.findFirst({ where: { stripePriceId: priceId } })
    : null;

  const userId = metadata.userId || byIdentity?.userId;
  const accountType = (metadata.accountType || byIdentity?.accountType || "PLAYER") as
    "PLAYER" | "BUSINESS" | "INFLUENCER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";
  const resolvedIdentityId = identityId || byIdentity?.kobaIdentityId;
  if (!userId || !resolvedIdentityId) {
    return null;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer?.id ?? byIdentity?.stripeCustomerId ?? null);

  const ended =
    state === "CANCELLED" || state === "EXPIRED" || state === "UNPAID"
      ? unixOrNow(subscription.ended_at)
      : null;

  const data = {
    userId,
    kobaIdentityId: resolvedIdentityId,
    accountType,
    planId: plan?.id ?? byIdentity?.planId ?? null,
    interval: plan?.interval ?? byIdentity?.interval ?? null,
    provider: "stripe",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeCheckoutSessionId: opts?.checkoutSessionId ?? byIdentity?.stripeCheckoutSessionId ?? null,
    state,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelledAt: unixOrNow(subscription.canceled_at),
    endedAt: ended,
    trialEndsAt: unixOrNow(subscription.trial_end),
    lastStripeEventId: opts?.eventId ?? byIdentity?.lastStripeEventId ?? null,
    lastStripeEventCreated:
      source === "webhook"
        ? (opts?.eventCreated ?? byIdentity?.lastStripeEventCreated ?? null)
        : (opts?.eventCreated ?? Math.floor(Date.now() / 1000)),
    version: { increment: 1 },
  };

  const saved = byIdentity
    ? await prisma.plusSubscription.update({
        where: { id: byIdentity.id },
        data,
        include: subscriptionInclude,
      })
    : await prisma.plusSubscription.create({
        data: {
          ...data,
          publicRef: await allocatePlusRef(),
          version: 1,
        },
        include: subscriptionInclude,
      });

  assertNoPlusSecrets({
    publicRef: saved.publicRef,
    state: saved.state,
    stripeSubscriptionId: saved.stripeSubscriptionId,
  });

  const becameActive = saved.state === "ACTIVE" && byIdentity?.state !== "ACTIVE";
  await writeAuditLog({
    actorUserId: userId,
    action: becameActive ? AuditAction.PLUS_ACTIVATED : AuditAction.PLUS_UPDATED,
    targetType: "PlusSubscription",
    targetId: saved.publicRef,
    metadata: {
      publicRef: saved.publicRef,
      state: saved.state,
      source,
      eventId: opts?.eventId ?? null,
    },
  });

  return saved;
}

function unixOrNow(value: number | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value * 1000);
}

export async function clearPlusCheckoutSession(sessionId: string) {
  await prisma.plusSubscription.updateMany({
    where: { stripeCheckoutSessionId: sessionId, state: { in: ["NONE", "INCOMPLETE"] } },
    data: { stripeCheckoutSessionId: null, state: "NONE" },
  });
}

export type PlusPlanCodeExport = PlusPlanCode;
