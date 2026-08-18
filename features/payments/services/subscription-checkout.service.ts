import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getPublicEnv } from "@/lib/env";
import { PaymentError } from "@/features/payments/lib/errors";
import { generateSubscriptionRef } from "@/features/payments/lib/order-ref";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { canCheckoutListing } from "@/features/payments/lib/money";
import { periodFromStripeSubscription } from "@/features/plus/lib/stripe-map";
import { resolveGameHandleForPlatforms } from "@/features/game-identity/services/game-identity.service";
import {
  isShopPlatformBanned,
  isUserPlatformBanned,
} from "@/features/blacklist/services/platform-blacklist.service";
import { isUserBlacklistedByShop } from "@/features/blacklist/services/shop-blacklist.service";
import {
  enqueueRconJob,
  executeRconJob,
  shouldDialRcon,
} from "@/features/payments/services/rcon-queue.service";
import type { SubscriptionCheckoutInput } from "@/features/payments/schemas/subscription-checkout.schemas";

/**
 * Recurring per-server VIP-rank purchase (ListingType SUBSCRIPTION —
 * client, 2026-08-18, KOBA-vs-Tip4Serv architecture spec). Mirrors
 * features/payments/services/checkout.service.ts's one-time flow for
 * every check that still applies (blacklist, self-buy, pre-linked game
 * identity), but is its own function because a Stripe Checkout Session
 * in `mode: "subscription"` needs a materially different payload
 * (price/quantity line item instead of price_data, a `customer` rather
 * than `customer_email`, subscription_data instead of payment_intent_
 * data) — bolting that onto createCheckoutSession's already-long branch
 * logic would make the one-time path harder to read for no shared gain.
 */
async function allocateSubscriptionRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateSubscriptionRef();
    const clash = await prisma.productSubscription.findUnique({ where: { publicRef } });
    if (!clash) return publicRef;
  }
  throw new PaymentError("Could not allocate a subscription reference.", "CONFLICT");
}

async function getOrCreateStripeCustomer(userId: string, email: string | null): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }
  const customer = await getStripe().customers.create({
    ...(email ? { email } : {}),
    metadata: { userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createSubscriptionCheckoutSession(
  buyerUserId: string,
  input: SubscriptionCheckoutInput,
) {
  if (!isStripeConfigured()) {
    throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }

  const product = await prisma.product.findUnique({
    where: { slug: input.slug },
    include: {
      shop: { include: { members: { select: { userId: true } } } },
      seller: { select: { email: true } },
    },
  });
  if (!product || product.moderationStatus !== "APPROVED" || product.publishedAt == null) {
    throw new PaymentError("Listing is not available.", "NOT_LIVE");
  }
  if (product.listingType !== "SUBSCRIPTION") {
    throw new PaymentError("This listing isn't a subscription.", "INVALID");
  }
  if (!product.shop) {
    throw new PaymentError("Listing is not tied to a shop.", "NOT_FOUND");
  }
  const shop = product.shop;
  if (!shop.stripeAccountId || !shop.chargesEnabled) {
    throw new PaymentError("This shop has not finished payout onboarding.", "SELLER_NOT_READY");
  }
  if (!product.rconServerId || !product.rconKitName || !product.expiryKitName || !product.stripePriceId) {
    throw new PaymentError("This subscription listing isn't fully configured yet.", "INVALID");
  }

  if (
    (await isUserPlatformBanned(buyerUserId)) ||
    (await isShopPlatformBanned(shop.id)) ||
    (await isUserBlacklistedByShop(shop.id, buyerUserId))
  ) {
    throw new PaymentError("This purchase is not available to your account.", "BLACKLISTED");
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

  // Same pre-linked-identity gate one-time RCON listings use — a
  // subscription's grant/expiry commands need somewhere to land too.
  const gamertag = await resolveGameHandleForPlatforms(buyerUserId, product.platforms);
  if (!gamertag) {
    throw new PaymentError(
      "Link your gamertag, PSN username, or Steam account in Settings before subscribing — it's needed to deliver it automatically.",
      "REQUIRES_GAME_IDENTITY",
    );
  }

  const existing = await prisma.productSubscription.findFirst({
    where: { buyerUserId, productId: product.id, status: { in: ["INCOMPLETE", "ACTIVE", "PAST_DUE"] } },
  });
  if (existing?.status === "ACTIVE" || existing?.status === "PAST_DUE") {
    throw new PaymentError("You already have an active subscription to this listing.", "CONFLICT");
  }

  const buyer = await prisma.user.findUnique({ where: { id: buyerUserId }, select: { email: true } });
  const customerId = await getOrCreateStripeCustomer(buyerUserId, buyer?.email ?? null);
  const publicRef = existing?.publicRef ?? (await allocateSubscriptionRef());
  const appUrl = getPublicEnv().appUrl;
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: publicRef,
      success_url: `${appUrl}/orders/subscriptions/${publicRef}?checkout=success`,
      cancel_url: `${appUrl}/market/${product.slug}?checkout=cancel`,
      line_items: [{ price: product.stripePriceId, quantity: 1 }],
      metadata: { kind: "product_subscription", subscriptionRef: publicRef },
      subscription_data: {
        metadata: { kind: "product_subscription", subscriptionRef: publicRef },
      },
    },
    { idempotencyKey: `subscription-checkout:${buyerUserId}:${input.idempotencyKey}` },
  );

  if (!session.url) {
    throw new PaymentError("Stripe did not return a checkout URL.", "INVALID");
  }

  await prisma.productSubscription.upsert({
    where: { publicRef },
    create: {
      publicRef,
      productId: product.id,
      shopId: shop.id,
      buyerUserId,
      serverId: product.rconServerId,
      gamertag,
      status: "INCOMPLETE",
    },
    update: {},
  });

  return { url: session.url, publicRef };
}

/** checkout.session.completed (mode=subscription) → ACTIVE, then
 * enqueue + attempt the initial grant command inline, same
 * instant-delivery shape one-time RCON listings have. */
export async function activateProductSubscription(input: {
  publicRef: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
}) {
  const subscription = await prisma.productSubscription.findUnique({
    where: { publicRef: input.publicRef },
    include: { product: { select: { rconServerId: true, rconKitName: true } } },
  });
  if (!subscription || subscription.status === "ACTIVE") return;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
  const currentPeriodEnd = periodFromStripeSubscription(stripeSub).end;

  await prisma.productSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "ACTIVE",
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeCustomerId: input.stripeCustomerId,
      currentPeriodEnd,
    },
  });

  await writeAuditLog({
    actorUserId: subscription.buyerUserId,
    action: AuditAction.PRODUCT_SUBSCRIPTION_ACTIVATED,
    targetType: "ProductSubscription",
    targetId: subscription.id,
    metadata: { publicRef: subscription.publicRef },
  });

  if (subscription.product.rconServerId && subscription.product.rconKitName) {
    const job = await enqueueRconJob({
      productSubscriptionId: subscription.id,
      serverId: subscription.product.rconServerId,
      kitName: subscription.product.rconKitName,
      gamertag: subscription.gamertag,
    });
    if (await shouldDialRcon(subscription.product.rconServerId)) {
      await executeRconJob(job.id);
    }
  }
}

export async function getSubscriptionReceipt(publicRef: string, viewerUserId: string) {
  const subscription = await prisma.productSubscription.findUnique({
    where: { publicRef },
    include: {
      product: { select: { title: true, priceCents: true, currency: true, subscriptionInterval: true } },
      shop: { select: { slug: true, name: true, ownerUserId: true } },
    },
  });
  if (!subscription) {
    throw new PaymentError("Subscription not found.", "NOT_FOUND");
  }
  const isBuyer = subscription.buyerUserId === viewerUserId;
  const isSeller = subscription.shop.ownerUserId === viewerUserId;
  if (!isBuyer && !isSeller) {
    throw new PaymentError("You cannot view this subscription.", "FORBIDDEN");
  }

  return {
    publicRef: subscription.publicRef,
    status: subscription.status,
    productTitle: subscription.product.title,
    priceCents: subscription.product.priceCents,
    currency: subscription.product.currency,
    interval: subscription.product.subscriptionInterval,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    shop: { slug: subscription.shop.slug, name: subscription.shop.name },
    confirming: subscription.status === "INCOMPLETE",
  };
}
