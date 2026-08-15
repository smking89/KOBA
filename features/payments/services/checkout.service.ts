import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getPublicEnv } from "@/lib/env";
import { PaymentError } from "@/features/payments/lib/errors";
import { generateOrderRef } from "@/features/payments/lib/order-ref";
import {
  canCheckoutListing,
  canPayReservedAuction,
  resolveCommissionBps,
  splitPayment,
} from "@/features/payments/lib/money";
import { computeEscrowReleaseAt, escrowHoldDays } from "@/features/payments/lib/escrow-rules";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import type { CheckoutInput } from "@/features/payments/schemas/checkout.schemas";

async function allocateOrderRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateOrderRef();
    const clash = await prisma.order.findUnique({ where: { publicRef } });
    if (!clash) {
      return publicRef;
    }
  }
  throw new PaymentError("Could not allocate an order reference.", "CONFLICT");
}

export async function createCheckoutSession(
  buyerUserId: string,
  input: CheckoutInput,
  ipAddress?: string | null,
) {
  if (!isStripeConfigured()) {
    throw new PaymentError(
      "Stripe test mode is not configured. Add sk_test_ keys to continue.",
      "NOT_CONFIGURED",
    );
  }

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { items: true },
  });
  if (existing) {
    if (existing.buyerUserId !== buyerUserId) {
      throw new PaymentError("Idempotency key already used.", "CONFLICT");
    }
    if (existing.status === "PAID" || existing.status === "FULFILLED") {
      return { publicRef: existing.publicRef, url: null as string | null, status: existing.status };
    }
    if (existing.status !== "PENDING") {
      throw new PaymentError("Idempotency key already used.", "CONFLICT");
    }
    if (existing.stripeCheckoutSessionId) {
      const session = await getStripe().checkout.sessions.retrieve(
        existing.stripeCheckoutSessionId,
      );
      if (session.url && session.status !== "expired") {
        return { publicRef: existing.publicRef, url: session.url, status: existing.status };
      }
    }
  }

  const product = await prisma.product.findUnique({
    where: { slug: input.slug },
    include: {
      shop: { include: { members: { select: { userId: true } } } },
      auction: true,
      seller: { select: { email: true } },
    },
  });
  if (!product || product.moderationStatus !== "APPROVED" || product.publishedAt == null) {
    throw new PaymentError("Listing is not available.", "NOT_LIVE");
  }
  if (!product.shop) {
    throw new PaymentError("Listing is not tied to a shop.", "NOT_FOUND");
  }
  const shop = product.shop;
  const stripeAccountId = shop.stripeAccountId;

  const shopMemberUserIds = shop.members.map((row) => row.userId);
  if (
    !canCheckoutListing({
      buyerUserId,
      sellerUserId: product.sellerUserId,
      shopMemberUserIds,
    })
  ) {
    throw new PaymentError("You cannot buy your own listing.", "SELF_BUY");
  }

  if (!stripeAccountId || !shop.chargesEnabled) {
    throw new PaymentError("This shop has not finished payout onboarding.", "SELLER_NOT_READY");
  }

  const now = new Date();
  const isAuction = product.listingType === "AUCTION";
  let quantity = input.quantity;
  let unitPriceCents = product.priceCents;

  if (isAuction) {
    if (!product.auction) {
      throw new PaymentError("Auction not found.", "NOT_FOUND");
    }
    if (
      !canPayReservedAuction({
        buyerUserId,
        winnerUserId: product.auction.winnerUserId,
        status: product.auction.status,
        reservedUntil: product.auction.reservedUntil,
        now,
      })
    ) {
      throw new PaymentError(
        "Only the winning bidder can check out this auction.",
        "AUCTION_LOCKED",
      );
    }
    quantity = 1;
    unitPriceCents = product.auction.highBidCents ?? product.priceCents;
  } else if (product.listingType !== "FIXED") {
    throw new PaymentError("This listing cannot be purchased.", "NOT_LIVE");
  }

  if (!existing && product.inventoryQty < quantity) {
    throw new PaymentError("Not enough inventory.", "SOLD_OUT");
  }

  const totalCents = unitPriceCents * quantity;
  const feeBps = resolveCommissionBps(shop.verificationStatus);
  const split = splitPayment(totalCents, feeBps);
  const publicRef = existing?.publicRef ?? (await allocateOrderRef());
  const buyer = await prisma.user.findUnique({
    where: { id: buyerUserId },
    select: { email: true },
  });

  const order = await prisma.$transaction(async (tx) => {
    if (existing) {
      return existing;
    }

    const created = await tx.order.create({
      data: {
        publicRef,
        shopId: shop.id,
        buyerUserId,
        status: "PENDING",
        kind: isAuction ? "AUCTION" : "FIXED",
        totalCents: split.totalCents,
        applicationFeeCents: split.applicationFeeCents,
        sellerPayoutCents: split.sellerPayoutCents,
        currency: product.currency,
        idempotencyKey: input.idempotencyKey,
        auctionId: product.auction?.id ?? null,
        items: {
          create: {
            productId: product.id,
            titleSnapshot: product.title,
            quantity,
            unitPriceCents,
          },
        },
      },
    });

    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: { inventoryQty: { decrement: quantity } },
    });
    if (updatedProduct.inventoryQty < 0) {
      throw new PaymentError("Not enough inventory.", "SOLD_OUT");
    }

    return created;
  });

  const appUrl = getPublicEnv().appUrl;
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: order.publicRef,
        ...(buyer?.email ? { customer_email: buyer.email } : {}),
        success_url: `${appUrl}/orders/${order.publicRef}?checkout=success`,
        cancel_url: `${appUrl}/market/${product.slug}?checkout=cancel`,
        line_items: [
          {
            quantity,
            price_data: {
              currency: product.currency.toLowerCase(),
              unit_amount: unitPriceCents,
              product_data: { name: product.title },
            },
          },
        ],
        // No transfer_data/application_fee_amount here: the charge settles to the
        // PLATFORM's own Stripe balance, not a destination charge to the seller's
        // Connect account. This is the escrow hold — the seller's payout
        // (order.sellerPayoutCents) is transferred out separately, later, by
        // escrow.service.ts's releaseEscrow (auto-release sweep or staff
        // dispute resolution), not instantly at charge time.
        payment_intent_data: {
          metadata: { orderRef: order.publicRef },
        },
        metadata: { orderRef: order.publicRef },
      },
      { idempotencyKey: `checkout:${order.publicRef}` },
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    await writeAuditLog({
      actorUserId: buyerUserId,
      action: AuditAction.CHECKOUT_CREATED,
      targetType: "Order",
      targetId: order.id,
      metadata: { publicRef: order.publicRef, slug: product.slug },
      ipAddress: ipAddress ?? null,
    });

    if (!session.url) {
      await restoreInventory(order.id);
      throw new PaymentError("Stripe did not return a checkout URL.", "NOT_CONFIGURED");
    }

    return { publicRef: order.publicRef, url: session.url, status: order.status };
  } catch (error) {
    if (error instanceof PaymentError) {
      throw error;
    }
    if (order.status === "PENDING") {
      await restoreInventory(order.id);
    }
    throw error;
  }
}

async function restoreInventory(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== "PENDING") {
      return;
    }
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { inventoryQty: { increment: item.quantity } },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
  });
}

export async function markOrderPaid(input: {
  publicRef: string;
  paymentIntentId: string | null;
  sessionId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { publicRef: input.publicRef },
  });
  if (!order) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  if (order.status === "PAID" || order.status === "FULFILLED" || order.status === "REFUNDED") {
    return order;
  }
  if (order.status !== "PENDING") {
    throw new PaymentError("Order cannot be marked paid.", "CONFLICT");
  }

  const paidAt = new Date();
  const paid = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt,
      stripePaymentIntentId: input.paymentIntentId,
      stripeCheckoutSessionId: input.sessionId,
    },
  });

  // The seller's payout stays on the platform's Stripe balance (no
  // transfer_data on the PaymentIntent) until this escrow hold clears —
  // see escrow.service.ts for release/dispute handling.
  await prisma.orderEscrow.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      status: "HOLDING",
      releaseAt: computeEscrowReleaseAt(paidAt, escrowHoldDays()),
    },
    update: {},
  });

  await writeAuditLog({
    actorUserId: null,
    action: AuditAction.ORDER_PAID,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef: order.publicRef },
  });

  return paid;
}

export async function expireCheckoutSession(sessionId: string) {
  const order = await prisma.order.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
  });
  if (!order) {
    return null;
  }
  if (order.status === "PENDING") {
    await restoreInventory(order.id);
  }
  return order;
}

export async function getOrderReceipt(publicRef: string, viewerUserId: string, isStaff = false) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: {
      items: true,
      shop: { select: { slug: true, name: true, ownerUserId: true } },
      buyer: { select: { id: true, name: true, email: true } },
      escrow: true,
    },
  });
  if (!order) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }

  const isBuyer = order.buyerUserId === viewerUserId;
  const isSeller = order.shop.ownerUserId === viewerUserId;
  if (!isBuyer && !isSeller && !isStaff) {
    throw new PaymentError("You cannot view this receipt.", "FORBIDDEN");
  }

  return {
    publicRef: order.publicRef,
    status: order.status,
    kind: order.kind,
    totalCents: order.totalCents,
    applicationFeeCents: isSeller || isStaff ? order.applicationFeeCents : null,
    sellerPayoutCents: isSeller || isStaff ? order.sellerPayoutCents : null,
    currency: order.currency,
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    shop: { slug: order.shop.slug, name: order.shop.name },
    items: order.items.map((item) => ({
      title: item.titleSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    confirming: order.status === "PENDING",
    viewerIsBuyer: isBuyer,
    escrow: order.escrow
      ? {
          status: order.escrow.status,
          releaseAt: order.escrow.releaseAt.toISOString(),
          disputeReason: isBuyer || isSeller || isStaff ? order.escrow.disputeReason : null,
        }
      : null,
  };
}

export async function listBuyerOrders(userId: string) {
  return prisma.order.findMany({
    where: { buyerUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { shop: { select: { name: true, slug: true } }, items: true },
  });
}

export async function refundOrder(actorUserId: string, publicRef: string, actorIsStaff: boolean) {
  if (!isStripeConfigured()) {
    throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }

  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { shop: true, items: true, escrow: true },
  });
  if (!order) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  if (!actorIsStaff && order.shop.ownerUserId !== actorUserId) {
    throw new PaymentError("Only the shop owner or KOBA staff can refund.", "FORBIDDEN");
  }
  if (order.status !== "PAID" && order.status !== "FULFILLED") {
    throw new PaymentError("Only paid orders can be refunded.", "CONFLICT");
  }
  if (!order.stripePaymentIntentId) {
    throw new PaymentError("Missing payment intent.", "NOT_FOUND");
  }

  // Escrow-aware: the seller's payout is only ever transferred out of the
  // platform's Stripe balance once escrow reaches RELEASED (see
  // escrow.service.ts). Before that, no `transfer_data`/destination transfer
  // exists on this PaymentIntent at all, so `reverse_transfer` would have
  // nothing to reverse. Only pass it once escrow has actually released.
  const escrowReleased = order.escrow?.status === "RELEASED";

  await getStripe().refunds.create({
    payment_intent: order.stripePaymentIntentId,
    ...(escrowReleased ? { reverse_transfer: true } : {}),
  });

  return markOrderRefunded(order.publicRef, actorUserId);
}

export async function markOrderRefunded(publicRef: string, actorUserId?: string | null) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { items: true, escrow: true },
  });
  if (!order) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  if (order.status === "REFUNDED") {
    return order;
  }

  const refunded = await prisma.$transaction(async (tx) => {
    if (order.status === "PAID" || order.status === "FULFILLED") {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { inventoryQty: { increment: item.quantity } },
        });
      }
    }
    // If escrow never reached RELEASED, no seller payout was ever sent — mark
    // the hold REFUNDED so the sweep won't try to release it later. If it was
    // already RELEASED, leave it as-is: the transfer reversal above (when
    // applicable) is the historical record of what happened to those funds.
    if (order.escrow && order.escrow.status !== "RELEASED" && order.escrow.status !== "REFUNDED") {
      await tx.orderEscrow.update({
        where: { orderId: order.id },
        data: { status: "REFUNDED" },
      });
    }
    return tx.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
  });

  await writeAuditLog({
    actorUserId: actorUserId ?? null,
    action: AuditAction.ORDER_REFUNDED,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef },
  });

  return refunded;
}

export async function fulfillOrder(actorUserId: string, publicRef: string) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { shop: true },
  });
  if (!order) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  if (order.shop.ownerUserId !== actorUserId) {
    throw new PaymentError("Only the shop owner can fulfill this order.", "FORBIDDEN");
  }
  if (order.status !== "PAID") {
    throw new PaymentError("Only paid orders can be fulfilled.", "CONFLICT");
  }

  const fulfilled = await prisma.order.update({
    where: { id: order.id },
    data: { status: "FULFILLED" },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.ORDER_FULFILLED,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef },
  });

  return fulfilled;
}
