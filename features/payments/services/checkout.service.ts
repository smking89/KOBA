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
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import type { CheckoutInput } from "@/features/payments/schemas/checkout.schemas";
import {
  resolveReferralForCheckout,
  voidReferralForRefundedOrder,
} from "@/features/influencer/services/influencer.service";
import { payInfluencerEarning } from "@/features/influencer/services/payout.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { buildPricingSnapshot, assertNonNegativeSnapshot } from "@/features/promotions/lib/pricing";
import { validatePromoForProduct, redeemPromoInTransaction } from "@/features/promotions/services/promo-code.service";
import { resolveCheckoutAttribution } from "@/features/promotions/services/attribution.service";
import {
  createCommissionForPaidOrder,
  reverseCommissionForOrder,
} from "@/features/promotions/services/commission.service";
import { PromotionError } from "@/features/promotions/lib/errors";

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

  const originalSubtotalCents = unitPriceCents * quantity;
  const feeBps = resolveCommissionBps(shop.verificationStatus);
  const checkoutStartedAt = new Date();
  const buyerSnapshot = await getAccountSnapshot(buyerUserId);

  let promo: Awaited<ReturnType<typeof validatePromoForProduct>> | null = null;
  if (!existing && input.promoCode) {
    try {
      promo = await validatePromoForProduct({
        code: input.promoCode,
        productId: product.id,
        shopId: shop.id,
        buyerUserId,
        subtotalCents: originalSubtotalCents,
        accountType: buyerSnapshot?.activeAccountType ?? "PLAYER",
      });
    } catch (error) {
      if (error instanceof PromotionError) {
        throw new PaymentError(error.message, "INVALID");
      }
      throw error;
    }
  }

  const campaignAttr = existing
    ? null
    : await resolveCheckoutAttribution({
        buyerUserId,
        productId: product.id,
        shopId: shop.id,
        shopOwnerUserId: shop.ownerUserId,
        promoCampaignId: promo?.campaignId ?? null,
        promoCodeId: promo?.promoCodeId ?? null,
        cookieToken: input.campaignReferralToken ?? null,
        checkoutStartedAt,
      });

  const campaign =
    campaignAttr
      ? await prisma.affiliateCampaign.findUnique({ where: { id: campaignAttr.campaignId } })
      : null;

  const snapshot = buildPricingSnapshot({
    originalSubtotalCents,
    discountCents: promo?.discountCents ?? 0,
    platformFeeBps: feeBps,
    commissionType: campaign?.commissionType ?? null,
    commissionValue: campaign?.commissionValue ?? null,
  });
  if (!assertNonNegativeSnapshot(snapshot)) {
    throw new PaymentError("Pricing snapshot is invalid.", "INVALID");
  }
  if (snapshot.eligibleCommissionBaseCents < 50 && snapshot.discountCents > 0) {
    throw new PaymentError("Discounted total is below the minimum charge.", "INVALID");
  }

  const baseSplit = splitPayment(snapshot.eligibleCommissionBaseCents, feeBps);
  const referral = existing || campaignAttr
    ? null
    : await resolveReferralForCheckout({
        code: input.referralCode,
        buyerUserId,
        productId: product.id,
        shopId: shop.id,
        shopOwnerUserId: shop.ownerUserId,
        shopMemberUserIds: shopMemberUserIds,
        split: baseSplit,
      });

  const influencerShareCents = campaignAttr
    ? snapshot.influencerCommissionCents
    : (referral?.split.influencerShareCents ?? 0);
  const split = campaignAttr
    ? {
        totalCents: snapshot.eligibleCommissionBaseCents,
        applicationFeeCents: snapshot.platformFeeCents + snapshot.influencerCommissionCents,
        sellerPayoutCents: snapshot.sellerProceedsCents,
      }
    : (referral?.split ?? {
        ...baseSplit,
        totalCents: snapshot.eligibleCommissionBaseCents,
        sellerPayoutCents: snapshot.sellerProceedsCents,
        applicationFeeCents: snapshot.platformFeeCents,
      });
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
        influencerShareCents,
        originalSubtotalCents: snapshot.originalSubtotalCents,
        discountCents: snapshot.discountCents,
        eligibleCommissionBaseCents: snapshot.eligibleCommissionBaseCents,
        promoCodeId: promo?.promoCodeId ?? null,
        campaignId: campaignAttr?.campaignId ?? null,
        participationId: campaignAttr?.participationId ?? null,
        attributionSource: campaignAttr?.source ?? null,
        referralCodeId: referral?.referralCodeId ?? null,
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

    if (promo) {
      await redeemPromoInTransaction(tx, {
        promoCodeId: promo.promoCodeId,
        userId: buyerUserId,
        orderId: created.id,
      });
    }

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
          snapshot.discountCents > 0
            ? {
                quantity: 1,
                price_data: {
                  currency: product.currency.toLowerCase(),
                  unit_amount: split.totalCents,
                  product_data: { name: `${product.title} (promo applied)` },
                },
              }
            : {
                quantity,
                price_data: {
                  currency: product.currency.toLowerCase(),
                  unit_amount: unitPriceCents,
                  product_data: { name: product.title },
                },
              },
        ],
        payment_intent_data: {
          application_fee_amount: split.applicationFeeCents,
          transfer_data: { destination: stripeAccountId },
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
    if (order.status !== "REFUNDED") {
      await createCommissionForPaidOrder(order.id).catch((error) => {
        console.error("[KOBA] campaign commission after duplicate paid event failed", error);
      });
    }
    return order;
  }
  if (order.status !== "PENDING") {
    throw new PaymentError("Order cannot be marked paid.", "CONFLICT");
  }

  const paid = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: input.paymentIntentId,
      stripeCheckoutSessionId: input.sessionId,
    },
  });

  await writeAuditLog({
    actorUserId: null,
    action: AuditAction.ORDER_PAID,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef: order.publicRef },
  });

  if (paid.referralCodeId) {
    await payInfluencerEarning(paid.id).catch((error) => {
      console.error("[KOBA] influencer payout after order paid failed", error);
    });
  }
  await createCommissionForPaidOrder(paid.id).catch((error) => {
    console.error("[KOBA] campaign commission after order paid failed", error);
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
    include: { shop: true, items: true },
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

  await getStripe().refunds.create({
    payment_intent: order.stripePaymentIntentId,
    reverse_transfer: true,
    refund_application_fee: true,
  });

  return markOrderRefunded(order.publicRef, actorUserId);
}

export async function markOrderRefunded(publicRef: string, actorUserId?: string | null) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { items: true },
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

  await voidReferralForRefundedOrder(order.id).catch((error) => {
    console.error("[KOBA] influencer earning void after refund failed", error);
  });
  await reverseCommissionForOrder(order.id, "refund").catch((error) => {
    console.error("[KOBA] campaign commission reverse after refund failed", error);
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
