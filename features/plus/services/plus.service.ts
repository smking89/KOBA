import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { PlusError } from "@/features/plus/lib/errors";
import {
  PLUS_PLANS,
  type PlusPlanInterval,
  type PlusSubscriptionView,
} from "@/features/plus/lib/types";

function toView(row: {
  state: PlusSubscriptionView["state"];
  planId: string | null;
  renewsAt: Date | null;
}): PlusSubscriptionView {
  return {
    state: row.state,
    planId: row.planId,
    renewsAt: row.renewsAt?.toISOString() ?? null,
    badgeVisible: row.state === "ACTIVE",
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
  let sub = await ensureSubscription(userId);
  sub = await markExpired(userId);
  return toView(sub);
}

export async function startCheckoutHandoff(
  userId: string,
  opts?: { planId?: string; interval?: PlusPlanInterval },
  ipAddress?: string | null,
): Promise<{ handoffUrl: string; subscription: PlusSubscriptionView }> {
  const plan =
    PLUS_PLANS.find((row) => row.id === opts?.planId) ??
    PLUS_PLANS.find((row) => row.interval === opts?.interval) ??
    PLUS_PLANS[0];
  if (!plan) {
    throw new PlusError("No Plus plan configured.", "INVALID");
  }

  const sub = await ensureSubscription(userId);
  // No Stripe charge — keep NONE or record PAST_DUE intent without activating
  const nextState = sub.state === "ACTIVE" ? sub.state : sub.state === "NONE" ? "NONE" : "PAST_DUE";

  const updated = await prisma.plusSubscription.update({
    where: { userId },
    data: {
      planId: plan.id,
      interval: plan.interval,
      state: nextState,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLUS_CHECKOUT_STARTED,
    targetType: "PlusSubscription",
    targetId: updated.id,
    metadata: { planId: plan.id, handoffUrl: plan.checkoutHandoff, charged: false },
    ipAddress: ipAddress ?? null,
  });

  return {
    handoffUrl: plan.checkoutHandoff,
    subscription: toView(updated),
  };
}

export async function cancelSubscription(
  userId: string,
  ipAddress?: string | null,
): Promise<PlusSubscriptionView> {
  await ensureSubscription(userId);
  const updated = await prisma.plusSubscription.update({
    where: { userId },
    data: { state: "CANCELLED" },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLUS_CANCELLED,
    targetType: "PlusSubscription",
    targetId: updated.id,
    metadata: {},
    ipAddress: ipAddress ?? null,
  });

  return toView(updated);
}

export async function markExpired(userId: string) {
  const sub = await ensureSubscription(userId);
  if (sub.renewsAt && sub.renewsAt.getTime() < Date.now() && sub.state === "ACTIVE") {
    return prisma.plusSubscription.update({
      where: { userId },
      data: { state: "EXPIRED" },
    });
  }
  return sub;
}
