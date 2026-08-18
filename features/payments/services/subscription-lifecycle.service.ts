/**
 * Post-activation webhook handling for ProductSubscription — renewal
 * settlement and churn-driven expiry. Client, 2026-08-18 (KOBA-vs-
 * Tip4Serv architecture spec), verbatim: "the platform must track
 * active subscriptions. Upon a Stripe cancellation or failed payment
 * webhook, the system must auto-queue 'Expiry Commands' (e.g., removing
 * a player from a VIP permission group)." Both triggers below act
 * immediately on the webhook, no grace period — that's the client's
 * own wording, not a guess.
 */
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getStripe } from "@/features/payments/lib/stripe";
import { resolveCommissionBps, splitPayment } from "@/features/payments/lib/money";
import { periodFromStripeSubscription, subscriptionIdFromInvoice } from "@/features/plus/lib/stripe-map";
import {
  enqueueRconJob,
  executeRconJob,
  shouldDialRcon,
} from "@/features/payments/services/rcon-queue.service";
import type Stripe from "stripe";

async function loadSubscriptionByStripeId(stripeSubscriptionId: string) {
  return prisma.productSubscription.findUnique({
    where: { stripeSubscriptionId },
    include: {
      product: { select: { rconServerId: true, expiryKitName: true } },
      shop: { select: { verificationStatus: true } },
    },
  });
}

async function queueExpiryCommand(subscription: {
  id: string;
  gamertag: string;
  product: { rconServerId: string | null; expiryKitName: string | null };
}) {
  if (!subscription.product.rconServerId || !subscription.product.expiryKitName) return;
  const job = await enqueueRconJob({
    productSubscriptionId: subscription.id,
    serverId: subscription.product.rconServerId,
    kitName: subscription.product.expiryKitName,
    gamertag: subscription.gamertag,
  });
  if (await shouldDialRcon(subscription.product.rconServerId)) {
    await executeRconJob(job.id);
  }
}

/** customer.subscription.deleted */
export async function cancelProductSubscription(stripeSubscriptionId: string) {
  const subscription = await loadSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription || subscription.status === "CANCELED") return;

  await prisma.productSubscription.update({
    where: { id: subscription.id },
    data: { status: "CANCELED", cancelledAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: subscription.buyerUserId,
    action: AuditAction.PRODUCT_SUBSCRIPTION_CANCELED,
    targetType: "ProductSubscription",
    targetId: subscription.id,
    metadata: { publicRef: subscription.publicRef },
  });
  await queueExpiryCommand(subscription);
}

/** invoice.payment_failed — client's spec treats a failed payment the
 * same as a cancellation for expiry purposes, immediately, not after a
 * dunning retry window. */
export async function expireProductSubscriptionForFailedPayment(stripeSubscriptionId: string) {
  const subscription = await loadSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription || subscription.status === "CANCELED" || subscription.status === "EXPIRED") return;

  await prisma.productSubscription.update({
    where: { id: subscription.id },
    data: { status: "EXPIRED" },
  });
  await writeAuditLog({
    actorUserId: subscription.buyerUserId,
    action: AuditAction.PRODUCT_SUBSCRIPTION_EXPIRED,
    targetType: "ProductSubscription",
    targetId: subscription.id,
    metadata: { publicRef: subscription.publicRef },
  });
  await queueExpiryCommand(subscription);
}

/** invoice.payment_succeeded for a renewal cycle only (billing_reason
 * "subscription_cycle" — the very first invoice is handled by
 * activateProductSubscription off checkout.session.completed instead).
 * Settles instantly via a direct Connect transfer — no escrow hold —
 * see the ProductSubscriptionInvoice schema doc comment for why a
 * recurring low-value renewal doesn't go through the same
 * hold/dispute window a one-time marketplace purchase does. */
export async function recordSubscriptionRenewalInvoice(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = subscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) return;

  const subscription = await loadSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription) return;

  const alreadyRecorded = await prisma.productSubscriptionInvoice.findUnique({
    where: { stripeInvoiceId: invoice.id },
  });
  if (alreadyRecorded) return;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const currentPeriodEnd = periodFromStripeSubscription(stripeSub).end;

  const feeBps = resolveCommissionBps(subscription.shop.verificationStatus);
  const split = splitPayment(invoice.amount_paid, feeBps);
  const currency = invoice.currency.toUpperCase();

  let stripeTransferId: string | null = null;
  if (split.sellerPayoutCents > 0) {
    const shop = await prisma.shop.findUnique({
      where: { id: subscription.shopId },
      select: { stripeAccountId: true },
    });
    if (shop?.stripeAccountId) {
      const transfer = await stripe.transfers.create(
        {
          amount: split.sellerPayoutCents,
          currency: currency.toLowerCase(),
          destination: shop.stripeAccountId,
          transfer_group: subscription.publicRef,
        },
        { idempotencyKey: `subscription-invoice-transfer:${invoice.id}` },
      );
      stripeTransferId = transfer.id;
    }
  }

  await prisma.$transaction([
    prisma.productSubscriptionInvoice.create({
      data: {
        subscriptionId: subscription.id,
        stripeInvoiceId: invoice.id,
        amountCents: invoice.amount_paid,
        applicationFeeCents: split.applicationFeeCents,
        sellerPayoutCents: split.sellerPayoutCents,
        currency,
        stripeTransferId,
      },
    }),
    prisma.productSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
      },
    }),
  ]);
}
