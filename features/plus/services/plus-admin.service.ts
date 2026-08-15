import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { requireAnyStaff } from "@/features/admin/services/admin.service";
import { isApprovedEntitlement } from "@/features/plus/lib/entitlements";
import { PlusError } from "@/features/plus/lib/errors";
import { publicPlusIdentifiers } from "@/features/plus/lib/stripe-map";
import { reconcilePlusSubscription } from "@/features/plus/services/plus-reconcile.service";

export async function searchPlusSubscriptions(actorUserId: string, query?: string) {
  await requireAnyStaff(actorUserId);
  const q = query?.trim();
  const rows = await prisma.plusSubscription.findMany({
    where: q
      ? {
          OR: [
            { publicRef: { contains: q, mode: "insensitive" } },
            { stripeSubscriptionId: { contains: q, mode: "insensitive" } },
            { stripeCustomerId: { contains: q, mode: "insensitive" } },
            { identity: { code: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {},
    include: {
      plan: { select: { code: true, displayName: true } },
      identity: { select: { code: true, accountType: true } },
      user: { select: { email: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  return rows.map((row) => ({
    ...publicPlusIdentifiers(row),
    state: row.state,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    planCode: row.plan?.code ?? null,
    accountType: row.accountType,
    kobaId: row.identity.code,
    email: row.user.email,
    lastStripeEventId: row.lastStripeEventId,
    lastStripeEventCreated: row.lastStripeEventCreated,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getPlusSubscriptionAdmin(actorUserId: string, publicRef: string) {
  await requireAnyStaff(actorUserId);
  const row = await prisma.plusSubscription.findUnique({
    where: { publicRef },
    include: {
      plan: { select: { code: true, displayName: true, interval: true } },
      identity: { select: { code: true, accountType: true } },
      user: { select: { email: true } },
    },
  });
  if (!row) {
    throw new PlusError("Subscription not found.", "NOT_FOUND");
  }

  const audit = await prisma.auditLog.findMany({
    where: { targetType: "PlusSubscription", targetId: publicRef },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, action: true, createdAt: true, actorUserId: true, metadata: true },
  });

  return {
    ...publicPlusIdentifiers(row),
    state: row.state,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    planCode: row.plan?.code ?? null,
    accountType: row.accountType,
    kobaId: row.identity.code,
    email: row.user.email,
    lastStripeEventId: row.lastStripeEventId,
    lastStripeEventCreated: row.lastStripeEventCreated,
    version: row.version,
    audit: audit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      actorUserId: entry.actorUserId,
    })),
  };
}

export async function staffReconcilePlus(actorUserId: string, publicRef: string) {
  await requireAnyStaff(actorUserId);
  return reconcilePlusSubscription(publicRef, actorUserId);
}

export async function issueCompensatoryGrant(
  actorUserId: string,
  input: { kobaIdentityId: string; code: string; reason: string; expiresAt?: string | null },
) {
  await requireAnyStaff(actorUserId);
  if (!isApprovedEntitlement(input.code)) {
    throw new PlusError("Only approved entitlement codes can be granted.", "INVALID");
  }
  const reason = input.reason.trim();
  if (reason.length < 8) {
    throw new PlusError("A grant reason is required.", "INVALID");
  }

  const identity = await prisma.kobaIdentity.findUnique({
    where: { id: input.kobaIdentityId },
  });
  if (!identity) {
    throw new PlusError("KOBA identity not found.", "NOT_FOUND");
  }

  const grant = await prisma.plusEntitlementGrant.create({
    data: {
      kobaIdentityId: identity.id,
      code: input.code,
      reason,
      actorUserId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.PLUS_GRANT_ISSUED,
    targetType: "PlusEntitlementGrant",
    targetId: grant.id,
    metadata: {
      kobaIdentityId: identity.id,
      code: input.code,
      expiresAt: grant.expiresAt?.toISOString() ?? null,
    },
  });

  return {
    id: grant.id,
    code: grant.code,
    expiresAt: grant.expiresAt?.toISOString() ?? null,
  };
}
