import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getPublicEnv } from "@/lib/env";
import { PaymentError } from "@/features/payments/lib/errors";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { InfluencerError } from "@/features/influencer/lib/errors";
import { settleReferralForPaidOrder } from "@/features/influencer/services/influencer.service";
import { logger } from "@/lib/observability/logger";

async function assertInfluencerMode(userId: string) {
  const profile = await prisma.accountProfile.findUnique({
    where: { userId },
    include: { user: { include: { kobaIdentities: { select: { accountType: true } } } } },
  });
  if (profile?.activeAccountType !== "INFLUENCER") {
    throw new InfluencerError("Switch to Influencer mode to connect payouts.", "FORBIDDEN");
  }
  if (!profile.user.kobaIdentities.some((row) => row.accountType === "INFLUENCER")) {
    throw new InfluencerError("An Influencer KOBAID is required.", "UNAUTHORIZED_ROLE");
  }
}

export async function getInfluencerPayoutStatus(userId: string) {
  await assertInfluencerMode(userId);
  const account = await prisma.influencerPayoutAccount.findUnique({ where: { userId } });
  return {
    configured: isStripeConfigured(),
    onboarded: Boolean(account?.stripeAccountId),
    payoutsEnabled: Boolean(account?.payoutsEnabled),
    detailsSubmitted: Boolean(account?.detailsSubmitted),
  };
}

export async function startInfluencerPayoutOnboarding(userId: string) {
  await assertInfluencerMode(userId);
  if (!isStripeConfigured()) {
    throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { handle: true } } },
  });
  if (!user) {
    throw new InfluencerError("Account not found.", "NOT_FOUND");
  }

  let row = await prisma.influencerPayoutAccount.findUnique({ where: { userId } });
  const stripe = getStripe();
  let accountId = row?.stripeAccountId ?? null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { kobaUserId: userId, handle: user.profile?.handle ?? "" },
    });
    accountId = account.id;
    row = await prisma.influencerPayoutAccount.upsert({
      where: { userId },
      create: { userId, stripeAccountId: accountId },
      update: { stripeAccountId: accountId },
    });
  }

  const appUrl = getPublicEnv().appUrl;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/influencer?payouts=refresh`,
    return_url: `${appUrl}/influencer?payouts=onboarded`,
    type: "account_onboarding",
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.INFLUENCER_PAYOUT_ONBOARDED,
    targetType: "InfluencerPayoutAccount",
    targetId: userId,
    metadata: { handle: user.profile?.handle ?? null },
  });

  return { url: link.url };
}

export async function refreshInfluencerPayoutAccount(userId: string) {
  await assertInfluencerMode(userId);
  if (!isStripeConfigured()) {
    throw new PaymentError("Stripe test mode is not configured.", "NOT_CONFIGURED");
  }
  const row = await prisma.influencerPayoutAccount.findUnique({ where: { userId } });
  if (!row?.stripeAccountId) {
    throw new InfluencerError("Payout onboarding has not started.", "NOT_FOUND");
  }
  const account = await getStripe().accounts.retrieve(row.stripeAccountId);
  return prisma.influencerPayoutAccount.update({
    where: { userId },
    data: {
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    },
  });
}

export async function payInfluencerEarning(orderId: string) {
  const earning = await settleReferralForPaidOrder(orderId);
  if (
    !earning ||
    earning.status === "PAID" ||
    earning.status === "VOID" ||
    earning.status === "HELD"
  ) {
    return earning;
  }
  if (earning.amountCents <= 0) {
    return earning;
  }
  if (!isStripeConfigured()) {
    return earning;
  }

  const account = await prisma.influencerPayoutAccount.findUnique({
    where: { userId: earning.influencerUserId },
  });
  if (!account?.stripeAccountId || !account.payoutsEnabled) {
    await prisma.influencerEarning.update({
      where: { id: earning.id },
      data: { status: "PAYABLE" },
    });
    return { ...earning, status: "PAYABLE" as const };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { publicRef: true, currency: true },
  });
  if (!order) return earning;

  try {
    const transfer = await getStripe().transfers.create(
      {
        amount: earning.amountCents,
        currency: order.currency.toLowerCase(),
        destination: account.stripeAccountId,
        transfer_group: order.publicRef,
        metadata: { earningRef: earning.publicRef, orderRef: order.publicRef },
      },
      { idempotencyKey: `inf-earn:${earning.id}` },
    );
    const paid = await prisma.influencerEarning.update({
      where: { id: earning.id },
      data: {
        status: "PAID",
        stripeTransferId: transfer.id,
        paidAt: new Date(),
      },
    });
    await writeAuditLog({
      actorUserId: null,
      action: AuditAction.INFLUENCER_EARNING_PAID,
      targetType: "InfluencerEarning",
      targetId: earning.id,
      metadata: { transferId: transfer.id, orderRef: order.publicRef },
    });
    return paid;
  } catch (error) {
    logger.error(
      "Influencer Stripe transfer failed",
      {
        event: "payment_side_effect_failure",
        operation: "influencer_transfer",
        outcome: "failure",
      },
      error,
    );
    await prisma.influencerEarning.update({
      where: { id: earning.id },
      data: { status: "PAYABLE" },
    });
    return { ...earning, status: "PAYABLE" as const };
  }
}

export async function retryPayableInfluencerPayouts(limit = 25) {
  const due = await prisma.influencerEarning.findMany({
    where: { status: { in: ["ACCRUED", "PAYABLE"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results = [];
  for (const row of due) {
    results.push(await payInfluencerEarning(row.orderId));
  }
  return results;
}
