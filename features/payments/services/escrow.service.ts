import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { PaymentError } from "@/features/payments/lib/errors";
import { actorIsStaff } from "@/features/payments/lib/staff";
import { canFlagDispute } from "@/features/payments/lib/escrow-rules";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { markOrderRefunded } from "@/features/payments/services/checkout.service";

export type DisputeResolution = "RELEASE" | "REFUND";

/**
 * Buyer flags a dispute on a still-holding escrow, freezing the auto-release
 * timer until staff resolves it. Only the order's buyer can do this, and only
 * before the release window passes.
 */
export async function flagDispute(buyerUserId: string, publicRef: string, reason: string) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { escrow: true },
  });
  if (!order || !order.escrow) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }

  const now = new Date();
  const eligible = canFlagDispute({
    buyerUserId,
    orderBuyerUserId: order.buyerUserId,
    escrowStatus: order.escrow.status,
    releaseAt: order.escrow.releaseAt,
    now,
  });
  if (!eligible) {
    if (order.buyerUserId !== buyerUserId) {
      throw new PaymentError("Only the buyer can dispute this order.", "FORBIDDEN");
    }
    throw new PaymentError("This order is not eligible for a dispute.", "CONFLICT");
  }

  const updated = await prisma.orderEscrow.update({
    where: { orderId: order.id },
    data: {
      status: "DISPUTED",
      disputedAt: now,
      disputeReason: reason,
      disputedByUserId: buyerUserId,
    },
  });

  await writeAuditLog({
    actorUserId: buyerUserId,
    action: AuditAction.ORDER_ESCROW_DISPUTED,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef, reason },
  });

  return updated;
}

/**
 * Staff-only. Resolves a DISPUTED escrow either by releasing the payout to
 * the seller or refunding the buyer. No arbitration workflow — this is the
 * whole resolution step.
 */
export async function resolveDispute(
  staffUserId: string,
  publicRef: string,
  resolution: DisputeResolution,
) {
  const staff = await actorIsStaff(staffUserId);
  if (!staff) {
    throw new PaymentError("Staff only.", "FORBIDDEN");
  }

  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { escrow: true },
  });
  if (!order || !order.escrow) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  if (order.escrow.status !== "DISPUTED") {
    throw new PaymentError("Escrow is not under dispute.", "CONFLICT");
  }

  await prisma.orderEscrow.update({
    where: { orderId: order.id },
    data: { resolvedAt: new Date(), resolvedByUserId: staffUserId },
  });

  if (resolution === "RELEASE") {
    await releaseEscrow(publicRef, staffUserId);
  } else {
    if (!isStripeConfigured()) {
      throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
    }
    if (!order.stripePaymentIntentId) {
      throw new PaymentError("Missing payment intent.", "NOT_FOUND");
    }
    // Distinct, simpler path than checkout.service.ts's refundOrder: since
    // escrow was still DISPUTED (never RELEASED), no seller transfer ever
    // happened, so there is nothing for Stripe to reverse_transfer.
    await getStripe().refunds.create({
      payment_intent: order.stripePaymentIntentId,
    });
    await markOrderRefunded(publicRef, staffUserId);
  }

  await writeAuditLog({
    actorUserId: staffUserId,
    action: AuditAction.ORDER_ESCROW_DISPUTE_RESOLVED,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef, resolution },
  });

  return prisma.orderEscrow.findUnique({ where: { orderId: order.id } });
}

/**
 * Transfers the seller's payout out of the platform's Stripe balance into
 * their Connect account and marks escrow RELEASED. Idempotent: a no-op if
 * already RELEASED/REFUNDED. Called either by the auto-release sweep (rows
 * still HOLDING) or directly by resolveDispute's RELEASE path (row already
 * verified DISPUTED there).
 */
export async function releaseEscrow(publicRef: string, actorUserId?: string | null) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { escrow: true, shop: true },
  });
  if (!order || !order.escrow) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  const escrow = order.escrow;

  if (escrow.status === "RELEASED" || escrow.status === "REFUNDED") {
    return escrow;
  }
  if (escrow.status !== "HOLDING" && escrow.status !== "DISPUTED") {
    throw new PaymentError("Escrow cannot be released from its current state.", "CONFLICT");
  }

  if (!isStripeConfigured()) {
    throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }
  if (!order.shop.stripeAccountId) {
    throw new PaymentError("This shop has not finished payout onboarding.", "SELLER_NOT_READY");
  }

  const transfer = await getStripe().transfers.create(
    {
      amount: order.sellerPayoutCents,
      currency: order.currency.toLowerCase(),
      destination: order.shop.stripeAccountId,
      transfer_group: order.publicRef,
    },
    { idempotencyKey: `escrow-release:${order.publicRef}` },
  );

  const released = await prisma.orderEscrow.update({
    where: { orderId: order.id },
    data: { status: "RELEASED", stripeTransferId: transfer.id },
  });

  await writeAuditLog({
    actorUserId: actorUserId ?? null,
    action: AuditAction.ORDER_ESCROW_RELEASED,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef, stripeTransferId: transfer.id },
  });

  return released;
}

export type EscrowSweepResult = {
  releasedRefs: string[];
  errors: Array<{ publicRef: string; message: string }>;
};

/**
 * Finds every HOLDING escrow row past its release window and releases it.
 * A future cron/manual trigger calls this — it is not scheduled here.
 * Individual failures are caught and collected so one bad row can't abort
 * the whole sweep.
 */
export async function sweepExpiredEscrowHolds(now: Date = new Date()): Promise<EscrowSweepResult> {
  const rows = await prisma.orderEscrow.findMany({
    where: { status: "HOLDING", releaseAt: { lte: now } },
    include: { order: { select: { publicRef: true } } },
  });

  const result: EscrowSweepResult = { releasedRefs: [], errors: [] };

  for (const row of rows) {
    const publicRef = row.order.publicRef;
    try {
      await releaseEscrow(publicRef, null);
      result.releasedRefs.push(publicRef);
    } catch (error) {
      result.errors.push({
        publicRef,
        message: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }

  return result;
}
