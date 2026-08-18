import { randomBytes } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getPublicEnv } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { exceedsStripeChargeLimit, splitPayment } from "@/features/payments/lib/money";
import { isPlatformFunctionEnabled } from "@/features/platform-control/services/platform-function.service";
import { KobaShopError } from "@/features/koba-shop/lib/errors";
import { isShopKobaShopApproved } from "@/features/koba-shop/services/application.service";
import {
  isShopPlatformBanned,
  isUserPlatformBanned,
} from "@/features/blacklist/services/platform-blacklist.service";

/** 2.5% flat (client, 2026-08-18) — a separate rate from the
 * Blue-Badge-tiered marketplace commission (features/payments/lib/
 * money.ts's resolveCommissionBps, 8%/4%), tied to KOBA Shop approval
 * rather than verification tier. */
export const KOBA_SHOP_COMMISSION_BPS = 250;

function generateCosmeticOrderRef(): string {
  return `KOBA-CSM-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function allocateCosmeticOrderRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateCosmeticOrderRef();
    const clash = await prisma.cosmeticOrder.findUnique({ where: { publicRef } });
    if (!clash) return publicRef;
  }
  throw new KobaShopError("Could not allocate an order reference.", "CONFLICT");
}

export async function createCosmeticCheckoutSession(
  buyerUserId: string,
  slug: string,
  idempotencyKey: string,
) {
  if (!isStripeConfigured()) {
    throw new KobaShopError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }
  if (!(await isPlatformFunctionEnabled("STRIPE_PAYMENTS"))) {
    throw new KobaShopError("Payments are temporarily disabled by KOBA staff.", "NOT_CONFIGURED");
  }

  const existing = await prisma.cosmeticOrder.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.buyerUserId !== buyerUserId) {
      throw new KobaShopError("Idempotency key already used.", "CONFLICT");
    }
    if (existing.status === "PAID") {
      return { publicRef: existing.publicRef, url: null as string | null, status: existing.status };
    }
    if (existing.status !== "PENDING") {
      throw new KobaShopError("Idempotency key already used.", "CONFLICT");
    }
    if (existing.stripeCheckoutSessionId) {
      const session = await getStripe().checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
      if (session.url && session.status !== "expired") {
        return { publicRef: existing.publicRef, url: session.url, status: existing.status };
      }
    }
  }

  const cosmetic = await prisma.cosmetic.findUnique({
    where: { slug },
    include: { ownerShop: true },
  });
  if (!cosmetic || cosmetic.moderationStatus !== "APPROVED") {
    throw new KobaShopError("This cosmetic is not available.", "NOT_LIVE");
  }
  const shop = cosmetic.ownerShop;

  if (!(await isShopKobaShopApproved(shop.id))) {
    throw new KobaShopError("This shop isn't approved for the KOBA Shop.", "NOT_APPROVED");
  }
  if (
    (await isUserPlatformBanned(buyerUserId)) ||
    (await isShopPlatformBanned(shop.id))
  ) {
    throw new KobaShopError("This purchase is not available to your account.", "FORBIDDEN");
  }
  if (!shop.stripeAccountId || !shop.chargesEnabled) {
    throw new KobaShopError("This shop has not finished payout onboarding.", "SELLER_NOT_READY");
  }

  const alreadyOwned = await prisma.cosmeticOwnership.findUnique({
    where: { userId_cosmeticId: { userId: buyerUserId, cosmeticId: cosmetic.id } },
  });
  if (alreadyOwned) {
    throw new KobaShopError("You already own this cosmetic.", "ALREADY_OWNED");
  }

  if (exceedsStripeChargeLimit(cosmetic.priceCents)) {
    throw new KobaShopError("This cosmetic's price is too large for a single checkout.", "AMOUNT_TOO_LARGE");
  }

  const split = splitPayment(cosmetic.priceCents, KOBA_SHOP_COMMISSION_BPS);
  const publicRef = existing?.publicRef ?? (await allocateCosmeticOrderRef());
  const buyer = await prisma.user.findUnique({ where: { id: buyerUserId }, select: { email: true } });

  const order =
    existing ??
    (await prisma.cosmeticOrder.create({
      data: {
        publicRef,
        idempotencyKey,
        cosmeticId: cosmetic.id,
        shopId: shop.id,
        buyerUserId,
        status: "PENDING",
        unitPriceCents: cosmetic.priceCents,
        applicationFeeCents: split.applicationFeeCents,
        sellerPayoutCents: split.sellerPayoutCents,
        currency: cosmetic.currency,
      },
    }));

  const appUrl = getPublicEnv().appUrl;
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: order.publicRef,
        ...(buyer?.email ? { customer_email: buyer.email } : {}),
        success_url: `${appUrl}/koba-shop/orders/${order.publicRef}?checkout=success`,
        cancel_url: `${appUrl}/koba-shop/${cosmetic.slug}?checkout=cancel`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: cosmetic.currency.toLowerCase(),
              unit_amount: cosmetic.priceCents,
              product_data: { name: cosmetic.name },
            },
          },
        ],
        // Direct destination charge — unlike Product orders, no escrow
        // hold: a digital cosmetic has none of the delivery-dispute risk
        // that motivated Product's separate escrow-release step.
        payment_intent_data: {
          application_fee_amount: split.applicationFeeCents,
          transfer_data: { destination: shop.stripeAccountId },
          metadata: { cosmeticOrderRef: order.publicRef },
        },
        metadata: { kind: "cosmetic_order", cosmeticOrderRef: order.publicRef },
      },
      { idempotencyKey: `cosmetic-checkout:${order.publicRef}` },
    );

    await prisma.cosmeticOrder.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) {
      throw new KobaShopError("Stripe did not return a checkout URL.", "NOT_CONFIGURED");
    }

    return { publicRef: order.publicRef, url: session.url, status: order.status };
  } catch (error) {
    if (error instanceof KobaShopError) throw error;
    throw error;
  }
}

/** Called from the Stripe webhook once payment_status is "paid" —
 * marks the order PAID and grants ownership in one transaction. */
export async function markCosmeticOrderPaid(input: {
  publicRef: string;
  paymentIntentId: string | null;
  sessionId: string;
}) {
  const order = await prisma.cosmeticOrder.findUnique({ where: { publicRef: input.publicRef } });
  if (!order || order.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.cosmeticOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        stripePaymentIntentId: input.paymentIntentId,
        stripeCheckoutSessionId: input.sessionId,
      },
    }),
    prisma.cosmeticOwnership.create({
      data: { userId: order.buyerUserId, cosmeticId: order.cosmeticId, orderId: order.id },
    }),
  ]);

  await writeAuditLog({
    actorUserId: order.buyerUserId,
    action: AuditAction.COSMETIC_PURCHASED,
    targetType: "CosmeticOrder",
    targetId: order.id,
    metadata: { publicRef: order.publicRef, cosmeticId: order.cosmeticId },
  });
}

export async function listOwnedCosmetics(userId: string) {
  return prisma.cosmeticOwnership.findMany({
    where: { userId },
    include: { cosmetic: true, personalEquip: true, shopEquip: true },
    orderBy: { acquiredAt: "desc" },
  });
}

export async function getCosmeticOrderReceipt(publicRef: string, viewerUserId: string) {
  const order = await prisma.cosmeticOrder.findUnique({
    where: { publicRef },
    include: { cosmetic: true, shop: { select: { name: true, slug: true } } },
  });
  if (!order || order.buyerUserId !== viewerUserId) return null;
  return order;
}
