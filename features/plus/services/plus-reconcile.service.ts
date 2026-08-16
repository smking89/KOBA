import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { PlusError } from "@/features/plus/lib/errors";
import {
  mapStripeSubscriptionStatus,
  periodFromStripeSubscription,
} from "@/features/plus/lib/stripe-map";
import { syncSubscriptionFromStripe } from "@/features/plus/services/plus.service";

export type PlusReconcileDiff = {
  publicRef: string;
  field: string;
  local: string | null;
  provider: string | null;
};

export async function reconcilePlusSubscription(publicRef: string, actorUserId?: string | null) {
  if (!isStripeConfigured()) {
    throw new PlusError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }

  const local = await prisma.plusSubscription.findUnique({
    where: { publicRef },
    include: { plan: { select: { code: true } } },
  });
  if (!local) {
    throw new PlusError("Subscription not found.", "NOT_FOUND");
  }
  if (!local.stripeSubscriptionId) {
    throw new PlusError("No Stripe subscription is linked.", "INVALID");
  }

  const provider = await getStripe().subscriptions.retrieve(local.stripeSubscriptionId);
  const period = periodFromStripeSubscription(provider);
  const providerState = mapStripeSubscriptionStatus(provider.status);

  const diffs: PlusReconcileDiff[] = [];
  const compare = (field: string, left: string | null, right: string | null) => {
    if (left !== right) diffs.push({ publicRef, field, local: left, provider: right });
  };

  compare("state", local.state, providerState);
  compare(
    "cancelAtPeriodEnd",
    String(local.cancelAtPeriodEnd),
    String(provider.cancel_at_period_end),
  );
  compare(
    "currentPeriodEnd",
    local.currentPeriodEnd?.toISOString() ?? null,
    period.end?.toISOString() ?? null,
  );
  compare(
    "stripeCustomerId",
    local.stripeCustomerId,
    typeof provider.customer === "string" ? provider.customer : (provider.customer?.id ?? null),
  );

  const updated = await syncSubscriptionFromStripe(provider, {
    source: "reconcile",
    eventCreated: Math.floor(Date.now() / 1000),
  });

  await writeAuditLog({
    actorUserId: actorUserId ?? null,
    action: AuditAction.PLUS_RECONCILED,
    targetType: "PlusSubscription",
    targetId: publicRef,
    metadata: { publicRef, diffs, providerState },
  });

  return {
    publicRef,
    diffs,
    state: updated?.state ?? providerState,
    aligned: diffs.length === 0,
  };
}

export async function reconcileDuePlusSubscriptions(limit = 25) {
  const rows = await prisma.plusSubscription.findMany({
    where: {
      stripeSubscriptionId: { not: null },
      state: { in: ["ACTIVE", "PAST_DUE", "TRIALING", "UNPAID"] },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { publicRef: true },
  });

  const results = [];
  for (const row of rows) {
    results.push(await reconcilePlusSubscription(row.publicRef, null));
  }
  return results;
}
