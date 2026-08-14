import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getPublicEnv } from "@/lib/env";
import { PaymentError } from "@/features/payments/lib/errors";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";

export async function getConnectStatus(userId: string) {
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) {
    throw new PaymentError("Create a shop first.", "NOT_FOUND");
  }
  return {
    configured: isStripeConfigured(),
    chargesEnabled: shop.chargesEnabled,
    payoutsEnabled: shop.payoutsEnabled,
    onboarded: Boolean(shop.stripeAccountId),
  };
}

export async function startConnectOnboarding(userId: string) {
  if (!isStripeConfigured()) {
    throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }

  const shop = await prisma.shop.findUnique({
    where: { ownerUserId: userId },
    include: { owner: { select: { email: true } } },
  });
  if (!shop) {
    throw new PaymentError("Create a shop first.", "NOT_FOUND");
  }

  const stripe = getStripe();
  let accountId = shop.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: shop.owner.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { shopSlug: shop.slug },
    });
    accountId = account.id;
    await prisma.shop.update({
      where: { id: shop.id },
      data: { stripeAccountId: accountId },
    });
  }

  const appUrl = getPublicEnv().appUrl;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/business/payouts?refresh=1`,
    return_url: `${appUrl}/business/payouts?onboarded=1`,
    type: "account_onboarding",
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CONNECT_ONBOARDED,
    targetType: "Shop",
    targetId: shop.id,
    metadata: { slug: shop.slug },
  });

  return { url: link.url };
}

export async function refreshConnectAccount(userId: string) {
  if (!isStripeConfigured()) {
    throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop?.stripeAccountId) {
    throw new PaymentError("Connect onboarding has not started.", "NOT_FOUND");
  }
  const account = await getStripe().accounts.retrieve(shop.stripeAccountId);
  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: {
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
    },
  });
  return {
    chargesEnabled: updated.chargesEnabled,
    payoutsEnabled: updated.payoutsEnabled,
  };
}
