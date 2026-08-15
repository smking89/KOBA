import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import { generateCommissionRef } from "@/features/promotions/lib/refs";
import {
  canTransitionCommission,
  isPastHold,
  refundCommissionStatus,
  type PromotionCommissionStatus,
} from "@/features/promotions/lib/commission-state";
import {
  notifyPromotion,
  recordPromotionEvent,
} from "@/features/promotions/services/events.service";

export async function createCommissionForPaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { campaign: true, participation: true },
  });
  if (!order || (order.status !== "PAID" && order.status !== "FULFILLED")) {
    return null;
  }
  if (!order.campaignId || !order.participationId || order.influencerShareCents <= 0) {
    return null;
  }
  const existing = await prisma.promotionCommission.findUnique({ where: { orderId: order.id } });
  if (existing) return existing;
  if (!order.campaign || !order.participation) return null;

  const amount = order.influencerShareCents;
  const claimed = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.promotionCommission.findUnique({ where: { orderId: order.id } });
    if (duplicate) return duplicate;
    const budget = await tx.affiliateCampaign.updateMany({
      where: {
        id: order.campaignId!,
        status: "ACTIVE",
        remainingBudgetCents: { gte: amount },
        ...(order.campaign?.totalConversionLimit == null
          ? {}
          : { conversionCount: { lt: order.campaign.totalConversionLimit } }),
      },
      data: {
        remainingBudgetCents: { decrement: amount },
        conversionCount: { increment: 1 },
      },
    });
    if (budget.count !== 1) {
      return null;
    }
    if (order.campaign?.perInfluencerLimitCents != null) {
      const earned = await tx.promotionCommission.aggregate({
        where: {
          campaignId: order.campaignId!,
          influencerUserId: order.participation!.influencerUserId,
          status: { notIn: ["REVERSED", "CANCELLED"] },
        },
        _sum: { amountCents: true },
      });
      const already = earned._sum.amountCents ?? 0;
      if (already + amount > order.campaign.perInfluencerLimitCents) {
        await tx.affiliateCampaign.update({
          where: { id: order.campaignId! },
          data: {
            remainingBudgetCents: { increment: amount },
            conversionCount: { decrement: 1 },
          },
        });
        return null;
      }
    }
    return tx.promotionCommission.create({
      data: {
        publicRef: generateCommissionRef(),
        campaignId: order.campaignId!,
        participationId: order.participationId!,
        influencerUserId: order.participation!.influencerUserId,
        sellerUserId: order.campaign!.sellerUserId,
        orderId: order.id,
        amountCents: amount,
        currency: order.currency,
        status: "PENDING",
        attributionSource: order.attributionSource ?? "CLICK",
        idempotencyKey: `commission:${order.id}`,
      },
    });
  });

  if (!claimed) {
    await recordPromotionEvent({
      type: "commission.budget_exhausted",
      campaignId: order.campaignId,
      orderId: order.id,
      idempotencyKey: `commission-skip:${order.id}`,
    });
    return null;
  }

  await writeAuditLog({
    actorUserId: null,
    action: AuditAction.PROMOTION_COMMISSION_CREATED,
    targetType: "PromotionCommission",
    targetId: claimed.id,
    metadata: { orderRef: order.publicRef },
  });
  await recordPromotionEvent({
    type: "commission.created",
    campaignId: order.campaignId,
    participationId: order.participationId,
    orderId: order.id,
    idempotencyKey: `commission-created:${order.id}`,
  });
  await notifyPromotion({
    userId: claimed.influencerUserId,
    type: "commission.created",
    title: "Commission pending",
    message: "A referred sale is pending the refund hold. This is not guaranteed money.",
    href: "/influencer/commissions",
  });
  return claimed;
}

export async function reverseCommissionForOrder(
  orderId: string,
  reason: "refund" | "chargeback" | "staff",
) {
  const commission = await prisma.promotionCommission.findUnique({ where: { orderId } });
  if (!commission) return null;
  const next = refundCommissionStatus(commission.status);
  if (!next) return commission;
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.promotionCommission.findUnique({ where: { id: commission.id } });
    if (!current || current.status === "REVERSED" || current.status === "CANCELLED") {
      return current;
    }
    const reversed = await tx.promotionCommission.update({
      where: { id: current.id },
      data: { status: "REVERSED", reversedAt: new Date(), reviewNote: reason },
    });
    await tx.affiliateCampaign.update({
      where: { id: current.campaignId },
      data: {
        remainingBudgetCents: { increment: current.amountCents },
        conversionCount: { decrement: 1 },
      },
    });
    return reversed;
  });
  if (updated && updated.status === "REVERSED") {
    await writeAuditLog({
      actorUserId: null,
      action: AuditAction.PROMOTION_COMMISSION_REVERSED,
      targetType: "PromotionCommission",
      targetId: updated.id,
      metadata: { reason },
    });
    await recordPromotionEvent({
      type: "commission.reversed",
      campaignId: commission.campaignId,
      orderId,
      payload: { reason },
      idempotencyKey: `commission-reversed:${orderId}:${reason}`,
    });
    await notifyPromotion({
      userId: commission.influencerUserId,
      type: "commission.reversed",
      title: "Commission reversed",
      message: "A pending or available commission was reversed after a refund or review.",
      href: "/influencer/commissions",
    });
  }
  return updated;
}

export async function qualifyDueCommissions(limit = 50) {
  const now = new Date();
  const pending = await prisma.promotionCommission.findMany({
    where: { status: "PENDING" },
    include: { order: { select: { status: true, refundedAt: true } } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  const results: Array<{ id: string; status: PromotionCommissionStatus }> = [];
  for (const row of pending) {
    if (row.order.status === "REFUNDED" || row.order.refundedAt) {
      const reversed = await reverseCommissionForOrder(row.orderId, "refund");
      if (reversed) results.push({ id: reversed.id, status: reversed.status });
      continue;
    }
    if (!isPastHold(row.createdAt, now)) continue;
    if (!canTransitionCommission(row.status, "QUALIFIED")) continue;
    const qualified = await prisma.promotionCommission.update({
      where: { id: row.id },
      data: { status: "QUALIFIED", qualifiedAt: now },
    });
    const available = await prisma.promotionCommission.update({
      where: { id: qualified.id },
      data: { status: "AVAILABLE", availableAt: now },
    });
    await notifyPromotion({
      userId: row.influencerUserId,
      type: "commission.qualified",
      title: "Commission available",
      message: "A commission passed the hold period. External payout remains deferred.",
      href: "/influencer/commissions",
    });
    await recordPromotionEvent({
      type: "commission.qualified",
      campaignId: row.campaignId,
      orderId: row.orderId,
      idempotencyKey: `commission-qualified:${row.id}`,
    });
    results.push({ id: available.id, status: available.status });
  }
  return results;
}

export async function staffSetCommissionStatus(input: {
  actorUserId: string;
  commissionId: string;
  status: PromotionCommissionStatus;
  note?: string;
}) {
  const commission = await prisma.promotionCommission.findUnique({
    where: { id: input.commissionId },
  });
  if (!commission) throw new PromotionError("Commission not found.", "NOT_FOUND");
  if (!canTransitionCommission(commission.status, input.status)) {
    throw new PromotionError("That commission status change is not allowed.", "CONFLICT");
  }
  if (input.status === "REVERSED") {
    return reverseCommissionForOrder(commission.orderId, "staff");
  }
  return prisma.promotionCommission.update({
    where: { id: commission.id },
    data: { status: input.status, reviewNote: input.note ?? commission.reviewNote },
  });
}

export async function listInfluencerCommissions(userId: string) {
  return prisma.promotionCommission.findMany({
    where: { influencerUserId: userId },
    include: {
      order: { select: { publicRef: true, status: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function totalsByCurrency(
  rows: Array<{ amountCents: number; currency: string; status: string }>,
) {
  const map = new Map<string, { pending: number; available: number; reversed: number }>();
  for (const row of rows) {
    const current = map.get(row.currency) ?? { pending: 0, available: 0, reversed: 0 };
    if (row.status === "PENDING" || row.status === "QUALIFIED" || row.status === "UNDER_REVIEW") {
      current.pending += row.amountCents;
    } else if (row.status === "AVAILABLE" || row.status === "PAID") {
      current.available += row.amountCents;
    } else if (row.status === "REVERSED") {
      current.reversed += row.amountCents;
    }
    map.set(row.currency, current);
  }
  return Array.from(map.entries()).map(([currency, amounts]) => ({ currency, ...amounts }));
}
