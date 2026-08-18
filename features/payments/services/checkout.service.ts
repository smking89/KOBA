import { AuditAction, type GamePlatform, type ProductRarity } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getPublicEnv } from "@/lib/env";
import { PaymentError } from "@/features/payments/lib/errors";
import { generateOrderRef } from "@/features/payments/lib/order-ref";
import { deliverRconKitForOrder } from "@/features/payments/services/rcon-delivery.service";
import {
  canCheckoutListing,
  canPayReservedAuction,
  exceedsStripeChargeLimit,
  resolveCommissionBps,
  splitPayment,
} from "@/features/payments/lib/money";
import { computeEscrowReleaseAt, escrowHoldDays } from "@/features/payments/lib/escrow-rules";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { isPlatformFunctionEnabled } from "@/features/platform-control/services/platform-function.service";
import { generateInventoryRef } from "@/features/trade/lib/refs";
import type { CheckoutInput } from "@/features/payments/schemas/checkout.schemas";
import {
  resolveReferralForCheckout,
  voidReferralForRefundedOrder,
} from "@/features/influencer/services/influencer.service";
import { payInfluencerEarning } from "@/features/influencer/services/payout.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { buildPricingSnapshot, assertNonNegativeSnapshot } from "@/features/promotions/lib/pricing";
import {
  validatePromoForProduct,
  redeemPromoInTransaction,
} from "@/features/promotions/services/promo-code.service";
import { resolveCheckoutAttribution } from "@/features/promotions/services/attribution.service";
import {
  isShopPlatformBanned,
  isUserPlatformBanned,
} from "@/features/blacklist/services/platform-blacklist.service";
import { isUserBlacklistedByShop } from "@/features/blacklist/services/shop-blacklist.service";
import {
  createCommissionForPaidOrder,
  reverseCommissionForOrder,
} from "@/features/promotions/services/commission.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import { emitAlert } from "@/lib/observability/alerts";
import { logger } from "@/lib/observability/logger";

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

type GrantableOrderItem = {
  productId: string;
  titleSnapshot: string;
  quantity: number;
  product: { game: { name: string }; rarity: ProductRarity; platforms: GamePlatform[] };
};

/**
 * Grants the buyer a real, tradeable InventoryItem per unit — shared by
 * fulfillOrder (paid orders) and claimFreebie (free claims), since a
 * free item should be just as real/tradeable as a paid one. One row per
 * unit (quantity > 1 grants that many discrete items, not one row with
 * a quantity field). Platform picks the product's first listed platform
 * when it supports several — a known simplification (no way to know
 * which platform the buyer actually plays on without asking).
 */
async function grantInventoryForOrderItems(
  buyerUserId: string,
  items: readonly GrantableOrderItem[],
): Promise<void> {
  for (const item of items) {
    for (let unit = 0; unit < item.quantity; unit += 1) {
      await prisma.inventoryItem.create({
        data: {
          publicRef: generateInventoryRef(),
          ownerUserId: buyerUserId,
          title: item.titleSnapshot,
          game: item.product.game.name,
          platform: item.product.platforms[0] ?? "STEAM",
          rarity: item.product.rarity,
          transferable: true,
          acquisitionSource: "PURCHASE",
          productId: item.productId,
        },
      });
    }
  }
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
  if (!(await isPlatformFunctionEnabled("STRIPE_PAYMENTS"))) {
    throw new PaymentError("Payments are temporarily disabled by KOBA staff.", "DISABLED");
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

  // Blacklist enforcement (features/blacklist) — defense in depth for a
  // session issued before a ban landed; a freshly-banned platform user
  // can't get a new session at all (lib/auth/credentials-provider.ts).
  if (
    (await isUserPlatformBanned(buyerUserId)) ||
    (await isShopPlatformBanned(shop.id)) ||
    (await isUserBlacklistedByShop(shop.id, buyerUserId))
  ) {
    throw new PaymentError("This purchase is not available to your account.", "BLACKLISTED");
  }

  if (product.rconKitName && !input.buyerGameHandle) {
    throw new PaymentError(
      "Enter your in-game gamertag to receive this automatically.",
      "INVALID",
    );
  }

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
  if (exceedsStripeChargeLimit(originalSubtotalCents)) {
    throw new PaymentError(
      "This order total is too large for a single checkout. Try a smaller quantity, or contact KOBA staff to arrange this purchase.",
      "AMOUNT_TOO_LARGE",
    );
  }
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

  const campaign = campaignAttr
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
  const referral =
    existing || campaignAttr
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
        buyerGameHandle: product.rconKitName ? (input.buyerGameHandle ?? null) : null,
        rconDeliveryStatus: product.rconKitName ? "PENDING" : "NOT_APPLICABLE",
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
    if (order.status !== "REFUNDED") {
      await createCommissionForPaidOrder(order.id).catch((error) => {
        logger.error(
          "Campaign commission after duplicate paid event failed",
          {
            event: "payment_side_effect_failure",
            operation: "commission_create",
            outcome: "failure",
          },
          error,
        );
      });
      // Self-healing: if a prior webhook attempt marked the order PAID
      // but never got to trigger delivery (e.g. the process died between
      // the two steps), a duplicate event is a free chance to catch up.
      // No-ops via deliverRconKitForOrder's own PENDING guard otherwise.
      if (order.rconDeliveryStatus === "PENDING") {
        await deliverRconKitForOrder(order.id).catch((error) => {
          logger.error(
            "Direct-RCON auto-delivery after duplicate paid event failed",
            {
              event: "payment_side_effect_failure",
              operation: "rcon_kit_delivery",
              outcome: "failure",
            },
            error,
          );
        });
      }
    }
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

  if (paid.referralCodeId) {
    await payInfluencerEarning(paid.id).catch((error) => {
      logger.error(
        "Influencer payout after order paid failed",
        {
          event: "payment_side_effect_failure",
          operation: "influencer_payout",
          outcome: "failure",
        },
        error,
      );
    });
  }
  await createCommissionForPaidOrder(paid.id).catch((error) => {
    logger.error(
      "Campaign commission after order paid failed",
      {
        event: "payment_side_effect_failure",
        operation: "commission_create",
        outcome: "failure",
      },
      error,
    );
  });

  if (paid.rconDeliveryStatus === "PENDING") {
    await deliverRconKitForOrder(paid.id).catch((error) => {
      logger.error(
        "Direct-RCON auto-delivery after order paid failed",
        {
          event: "payment_side_effect_failure",
          operation: "rcon_kit_delivery",
          outcome: "failure",
        },
        error,
      );
    });
  }

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
    viewerIsSeller: isSeller,
    rconDeliveryStatus: order.rconDeliveryStatus,
    rconDeliveryError: isSeller || isStaff ? order.rconDeliveryError : null,
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

  // Escrow-aware: this PaymentIntent is a plain platform-balance charge with
  // no `transfer_data` attached — `reverse_transfer: true` only reverses a
  // transfer attached to the charge itself. Seller payout is a separate
  // `stripe.transfers.create()` in escrow.service.ts#releaseEscrow.
  const stripe = getStripe();
  try {
    if (order.escrow?.status === "RELEASED" && order.escrow.stripeTransferId) {
      await stripe.transfers.createReversal(
        order.escrow.stripeTransferId,
        { amount: order.sellerPayoutCents },
        { idempotencyKey: `transfer-reversal:${order.publicRef}` },
      );
    }

    await stripe.refunds.create(
      { payment_intent: order.stripePaymentIntentId },
      { idempotencyKey: `refund:${order.publicRef}` },
    );
  } catch (error) {
    await emitAlert("refund_failure", "Stripe refund create failed", {
      labels: { operation: "refund", errorClass: "payment" },
      error,
    });
    throw error;
  }

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

  await voidReferralForRefundedOrder(order.id).catch((error) => {
    logger.error(
      "Influencer earning void after refund failed",
      {
        event: "payment_side_effect_failure",
        operation: "referral_void",
        outcome: "failure",
      },
      error,
    );
  });
  await reverseCommissionForOrder(order.id, "refund").catch((error) => {
    logger.error(
      "Campaign commission reverse after refund failed",
      {
        event: "payment_side_effect_failure",
        operation: "commission_reverse",
        outcome: "failure",
      },
      error,
    );
  });

  return refunded;
}

export async function fulfillOrder(actorUserId: string, publicRef: string) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: {
      shop: true,
      items: {
        include: {
          product: { select: { game: { select: { name: true } }, rarity: true, platforms: true } },
        },
      },
    },
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

  // Closes a real gap (createInventoryItem existed with an
  // InventoryAcquisitionSource.PURCHASE value clearly anticipating this,
  // but nothing ever called it from order fulfillment). Without this,
  // Phase 19's rarity-matched trading could only ever operate on
  // seeded/admin-granted items, never anything a buyer actually bought.
  await grantInventoryForOrderItems(order.buyerUserId, order.items);

  await writeAuditLog({
    actorUserId,
    action: AuditAction.ORDER_FULFILLED,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef },
  });

  return fulfilled;
}

/**
 * $0 claim path for a Freebie product (ROADMAP.md Phase 18) — a
 * separate flow from paid checkout, never touches Stripe (a $0 Checkout
 * Session is possible but wasteful for a transaction moving no money).
 * Goes straight to FULFILLED in one transaction: there is no payment
 * intent to wait on, so the PENDING -> PAID -> FULFILLED sequence real
 * money orders go through doesn't apply here — nothing meaningful is
 * being bypassed, there's simply nothing to confirm.
 *
 * Gated on the same MARKETPLACE_CHECKOUT platform-function switch as
 * paid checkout (features/platform-control) — not STRIPE_PAYMENTS,
 * since disabling Stripe shouldn't block a free claim that never
 * touches it.
 */
export async function claimFreebie(buyerUserId: string, slug: string, ipAddress?: string | null) {
  if (!(await isPlatformFunctionEnabled("MARKETPLACE_CHECKOUT"))) {
    throw new PaymentError(
      "Marketplace checkout is temporarily disabled by KOBA staff.",
      "DISABLED",
    );
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      shop: { include: { members: { select: { userId: true } } } },
      game: { select: { name: true } },
    },
  });
  if (!product || product.moderationStatus !== "APPROVED" || product.publishedAt == null) {
    throw new PaymentError("Listing is not available.", "NOT_LIVE");
  }
  if (!product.shop) {
    throw new PaymentError("Listing is not tied to a shop.", "NOT_FOUND");
  }
  if (product.freebiePolicy === "NONE") {
    throw new PaymentError("This listing is not a freebie.", "NOT_FREEBIE");
  }

  if (
    (await isUserPlatformBanned(buyerUserId)) ||
    (await isShopPlatformBanned(product.shop.id)) ||
    (await isUserBlacklistedByShop(product.shop.id, buyerUserId))
  ) {
    throw new PaymentError("This claim is not available to your account.", "BLACKLISTED");
  }

  const shopMemberUserIds = product.shop.members.map((row) => row.userId);
  if (
    !canCheckoutListing({
      buyerUserId,
      sellerUserId: product.sellerUserId,
      shopMemberUserIds,
    })
  ) {
    throw new PaymentError("You cannot claim your own listing.", "SELF_BUY");
  }

  // One-claim-per-buyer, checked up front for a clear error message —
  // the @@unique([productId, buyerUserId]) constraint is the real
  // enforcement (race-safe), this is just a friendlier early exit.
  const existingClaim = await prisma.freebieClaim.findUnique({
    where: { productId_buyerUserId: { productId: product.id, buyerUserId } },
  });
  if (existingClaim) {
    throw new PaymentError("You already claimed this freebie.", "CONFLICT");
  }

  const publicRef = await allocateOrderRef();
  const shopId = product.shop.id;

  const order = await prisma.$transaction(async (tx) => {
    // A free claim still consumes real stock — inventoryQty decrements
    // either way. LIMITED_QUANTITY additionally decrements its own
    // independent counter; PERMANENT has no such cap (free for as long
    // as stock lasts, not infinite stock).
    if (product.freebiePolicy === "LIMITED_QUANTITY") {
      if (product.freebieQuantityRemaining == null || product.freebieQuantityRemaining <= 0) {
        throw new PaymentError("This freebie is no longer available.", "SOLD_OUT");
      }
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { freebieQuantityRemaining: { decrement: 1 }, inventoryQty: { decrement: 1 } },
      });
      if ((updated.freebieQuantityRemaining ?? -1) < 0 || updated.inventoryQty < 0) {
        throw new PaymentError("This freebie is no longer available.", "SOLD_OUT");
      }
    } else {
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { inventoryQty: { decrement: 1 } },
      });
      if (updated.inventoryQty < 0) {
        throw new PaymentError("This item is out of stock.", "SOLD_OUT");
      }
    }

    const created = await tx.order.create({
      data: {
        publicRef,
        shopId,
        buyerUserId,
        status: "FULFILLED",
        kind: "FIXED",
        totalCents: 0,
        applicationFeeCents: 0,
        sellerPayoutCents: 0,
        currency: product.currency,
        idempotencyKey: `freebie:${product.id}:${buyerUserId}`,
        paidAt: new Date(),
        items: {
          create: {
            productId: product.id,
            titleSnapshot: product.title,
            quantity: 1,
            unitPriceCents: 0,
          },
        },
      },
    });

    await tx.freebieClaim.create({
      data: { productId: product.id, buyerUserId, orderId: created.id },
    });

    return created;
  });

  await grantInventoryForOrderItems(buyerUserId, [
    {
      productId: product.id,
      titleSnapshot: product.title,
      quantity: 1,
      product: { game: product.game, rarity: product.rarity, platforms: product.platforms },
    },
  ]);

  await writeAuditLog({
    actorUserId: buyerUserId,
    action: AuditAction.FREEBIE_CLAIMED,
    targetType: "Order",
    targetId: order.id,
    metadata: { publicRef: order.publicRef, productSlug: product.slug },
    ipAddress: ipAddress ?? null,
  });

  return order;
}
