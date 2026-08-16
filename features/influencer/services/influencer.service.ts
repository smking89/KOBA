import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { InfluencerError } from "@/features/influencer/lib/errors";
import {
  applyInfluencerShare,
  canUseReferral,
  influencerShareCents,
  isValidPromoConfig,
} from "@/features/influencer/lib/payouts";
import {
  buildReferralCode,
  generateEarningRef,
  generateReferralRef,
  normalizeReferralCode,
  referralSharePath,
} from "@/features/influencer/lib/refs";
import type {
  InfluencerDashboardView,
  PublicPromoListing,
  ReferralCodeView,
  ShopPromoView,
} from "@/features/influencer/lib/types";
import type {
  CreateReferralCodeInput,
  UpdateShopPromoInput,
} from "@/features/influencer/schemas/influencer.schemas";
import type { PaymentSplit } from "@/features/influencer/lib/payouts";

async function assertInfluencer(userId: string) {
  const profile = await prisma.accountProfile.findUnique({
    where: { userId },
    include: {
      user: { include: { kobaIdentities: { select: { accountType: true, code: true } } } },
    },
  });
  if (!profile) {
    throw new InfluencerError("Account not found.", "NOT_FOUND");
  }
  if (profile.activeAccountType !== "INFLUENCER") {
    throw new InfluencerError("Switch to Influencer mode to manage promo codes.", "FORBIDDEN");
  }
  const identity = profile.user.kobaIdentities.find((row) => row.accountType === "INFLUENCER");
  if (!identity) {
    throw new InfluencerError("An Influencer KOBAID is required.", "UNAUTHORIZED_ROLE");
  }
  return { handle: profile.handle, displayName: profile.displayName, kobaId: identity.code };
}

function mapCode(row: {
  publicRef: string;
  code: string;
  active: boolean;
  clickCount: number;
  createdAt: Date;
  product: { slug: string; title: string };
  shop: { slug: string; name: string };
}): ReferralCodeView {
  return {
    publicRef: row.publicRef,
    code: row.code,
    active: row.active,
    clickCount: row.clickCount,
    productSlug: row.product.slug,
    productTitle: row.product.title,
    shopSlug: row.shop.slug,
    shopName: row.shop.name,
    createdAt: row.createdAt.toISOString(),
    sharePath: referralSharePath(row.code),
  };
}

export async function getInfluencerDashboard(userId: string): Promise<InfluencerDashboardView> {
  const identity = await assertInfluencer(userId);
  const [codes, earnings, payout] = await Promise.all([
    prisma.referralCode.findMany({
      where: { influencerUserId: userId },
      include: {
        product: { select: { slug: true, title: true } },
        shop: { select: { slug: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.influencerEarning.findMany({
      where: { influencerUserId: userId },
      include: { order: { select: { publicRef: true } }, referralCode: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.influencerPayoutAccount.findUnique({ where: { userId } }),
  ]);

  const clicks = codes.reduce((sum, row) => sum + row.clickCount, 0);
  const conversions = earnings.filter((row) => row.status !== "VOID").length;
  const accruedCents = earnings
    .filter((row) => row.status === "ACCRUED" || row.status === "PAYABLE")
    .reduce((sum, row) => sum + row.amountCents, 0);
  const paidCents = earnings
    .filter((row) => row.status === "PAID")
    .reduce((sum, row) => sum + row.amountCents, 0);

  return {
    handle: identity.handle,
    kobaId: identity.kobaId,
    payoutsEnabled: Boolean(payout?.payoutsEnabled),
    onboarded: Boolean(payout?.stripeAccountId),
    clicks,
    conversions,
    accruedCents,
    paidCents,
    codes: codes.map(mapCode),
    earnings: earnings.map((row) => ({
      publicRef: row.publicRef,
      amountCents: row.amountCents,
      currency: row.currency,
      status: row.status,
      orderRef: row.order.publicRef,
      code: row.referralCode.code,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
    })),
  };
}

export async function createReferralCode(
  userId: string,
  input: CreateReferralCodeInput,
  ipAddress?: string | null,
): Promise<ReferralCodeView> {
  const identity = await assertInfluencer(userId);
  const product = await prisma.product.findUnique({
    where: { slug: input.productSlug },
    include: {
      shop: { include: { promoConfig: true, members: { select: { userId: true } } } },
    },
  });
  if (!product?.shop || product.moderationStatus !== "APPROVED" || product.publishedAt == null) {
    throw new InfluencerError("Listing is not available for promo.", "NOT_FOUND");
  }
  const shop = product.shop;
  if (!shop.promoConfig?.influencerEligible) {
    throw new InfluencerError("This shop has not enabled influencer promos.", "NOT_ELIGIBLE");
  }
  if (shop.ownerUserId === userId || shop.members.some((row) => row.userId === userId)) {
    throw new InfluencerError("You cannot promote your own shop listings.", "SELF_REFERRAL");
  }

  const code = buildReferralCode(identity.handle, product.slug);
  if (!code) {
    throw new InfluencerError("Could not build a referral code from this handle.", "INVALID");
  }

  const existing = await prisma.referralCode.findUnique({
    where: { influencerUserId_productId: { influencerUserId: userId, productId: product.id } },
    include: {
      product: { select: { slug: true, title: true } },
      shop: { select: { slug: true, name: true } },
    },
  });
  if (existing) {
    if (!existing.active) {
      const restored = await prisma.referralCode.update({
        where: { id: existing.id },
        data: { active: true, revokedAt: null, code },
        include: {
          product: { select: { slug: true, title: true } },
          shop: { select: { slug: true, name: true } },
        },
      });
      return mapCode(restored);
    }
    return mapCode(existing);
  }

  const created = await prisma.referralCode
    .create({
      data: {
        publicRef: generateReferralRef(),
        code,
        influencerUserId: userId,
        productId: product.id,
        shopId: shop.id,
      },
      include: {
        product: { select: { slug: true, title: true } },
        shop: { select: { slug: true, name: true } },
      },
    })
    .catch(async (error: unknown) => {
      const clash = await prisma.referralCode.findUnique({
        where: { code },
        include: {
          product: { select: { slug: true, title: true } },
          shop: { select: { slug: true, name: true } },
        },
      });
      if (clash?.influencerUserId === userId) {
        return clash;
      }
      const suffixed = await prisma.referralCode.create({
        data: {
          publicRef: generateReferralRef(),
          code: `${code}-${generateReferralRef().slice(-4)}`,
          influencerUserId: userId,
          productId: product.id,
          shopId: shop.id,
        },
        include: {
          product: { select: { slug: true, title: true } },
          shop: { select: { slug: true, name: true } },
        },
      });
      void error;
      return suffixed;
    });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.REFERRAL_CODE_CREATED,
    targetType: "ReferralCode",
    targetId: created.id,
    metadata: { code: created.code, productSlug: product.slug },
    ipAddress: ipAddress ?? null,
  });

  return mapCode(created);
}

export async function revokeReferralCode(userId: string, code: string, ipAddress?: string | null) {
  await assertInfluencer(userId);
  const normalized = normalizeReferralCode(code);
  const row = await prisma.referralCode.findUnique({ where: { code: normalized } });
  if (!row || row.influencerUserId !== userId) {
    throw new InfluencerError("Referral code not found.", "NOT_FOUND");
  }
  if (!row.active) {
    return { code: row.code, active: false };
  }
  await prisma.referralCode.update({
    where: { id: row.id },
    data: { active: false, revokedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.REFERRAL_CODE_REVOKED,
    targetType: "ReferralCode",
    targetId: row.id,
    metadata: { code: row.code },
    ipAddress: ipAddress ?? null,
  });
  return { code: row.code, active: false };
}

export async function getShopPromo(userId: string): Promise<ShopPromoView> {
  const shop = await prisma.shop.findUnique({
    where: { ownerUserId: userId },
    include: { promoConfig: true },
  });
  if (!shop) {
    throw new InfluencerError("Create a shop first.", "NOT_FOUND");
  }
  return {
    influencerEligible: shop.promoConfig?.influencerEligible ?? false,
    payoutType: shop.promoConfig?.payoutType ?? "PERCENT_BPS",
    payoutValue: shop.promoConfig?.payoutValue ?? 1000,
  };
}

export async function updateShopPromo(
  userId: string,
  input: UpdateShopPromoInput,
  ipAddress?: string | null,
): Promise<ShopPromoView> {
  const profile = await prisma.accountProfile.findUnique({ where: { userId } });
  if (profile?.activeAccountType !== "BUSINESS") {
    throw new InfluencerError("Switch to Business mode to edit promo terms.", "FORBIDDEN");
  }
  if (!isValidPromoConfig(input)) {
    throw new InfluencerError("Invalid promo payout terms.", "INVALID");
  }
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) {
    throw new InfluencerError("Create a shop first.", "NOT_FOUND");
  }
  const config = await prisma.shopPromoConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      influencerEligible: input.influencerEligible,
      payoutType: input.payoutType,
      payoutValue: input.payoutValue,
    },
    update: {
      influencerEligible: input.influencerEligible,
      payoutType: input.payoutType,
      payoutValue: input.payoutValue,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SHOP_PROMO_UPDATED,
    targetType: "Shop",
    targetId: shop.id,
    metadata: {
      influencerEligible: config.influencerEligible,
      payoutType: config.payoutType,
      payoutValue: config.payoutValue,
    },
    ipAddress: ipAddress ?? null,
  });
  return {
    influencerEligible: config.influencerEligible,
    payoutType: config.payoutType,
    payoutValue: config.payoutValue,
  };
}

export type ResolvedReferral = {
  referralCodeId: string;
  influencerUserId: string;
  productSlug: string;
  handle: string;
  split: PaymentSplit & { influencerShareCents: number };
};

export async function resolveReferralForCheckout(input: {
  code: string | null | undefined;
  buyerUserId: string;
  productId: string;
  shopId: string;
  shopOwnerUserId: string;
  shopMemberUserIds: readonly string[];
  split: PaymentSplit;
}): Promise<ResolvedReferral | null> {
  if (!input.code) return null;
  const normalized = normalizeReferralCode(input.code);
  if (!normalized) return null;
  const row = await prisma.referralCode.findUnique({
    where: { code: normalized },
    include: {
      shop: { include: { promoConfig: true } },
      influencer: { select: { profile: { select: { handle: true } } } },
      product: { select: { slug: true } },
    },
  });
  if (!row?.active || row.productId !== input.productId || row.shopId !== input.shopId) {
    return null;
  }
  if (!row.shop.promoConfig?.influencerEligible) {
    return null;
  }
  if (
    !canUseReferral({
      buyerUserId: input.buyerUserId,
      influencerUserId: row.influencerUserId,
      shopOwnerUserId: input.shopOwnerUserId,
      shopMemberUserIds: input.shopMemberUserIds,
    })
  ) {
    return null;
  }
  const share = influencerShareCents({
    totalCents: input.split.totalCents,
    sellerPayoutCents: input.split.sellerPayoutCents,
    payoutType: row.shop.promoConfig.payoutType,
    payoutValue: row.shop.promoConfig.payoutValue,
  });
  return {
    referralCodeId: row.id,
    influencerUserId: row.influencerUserId,
    productSlug: row.product.slug,
    handle: row.influencer.profile?.handle ?? "creator",
    split: applyInfluencerShare(input.split, share),
  };
}

export async function resolvePublicReferral(code: string) {
  const normalized = normalizeReferralCode(code);
  const row = await prisma.referralCode.findUnique({
    where: { code: normalized },
    include: {
      product: { select: { slug: true, title: true } },
      influencer: { select: { profile: { select: { handle: true, displayName: true } } } },
    },
  });
  if (!row?.active) return null;
  return {
    id: row.id,
    code: row.code,
    productSlug: row.product.slug,
    productTitle: row.product.title,
    handle: row.influencer.profile?.handle ?? "creator",
    displayName: row.influencer.profile?.displayName ?? null,
  };
}

export async function recordReferralClick(referralCodeId: string) {
  await prisma.referralCode.update({
    where: { id: referralCodeId },
    data: { clickCount: { increment: 1 } },
  });
}

export async function getPublicPromo(handle: string): Promise<PublicPromoListing | null> {
  const normalized = handle.trim().toLowerCase();
  const profile = await prisma.accountProfile.findUnique({
    where: { handle: normalized },
    include: {
      user: {
        include: {
          kobaIdentities: { select: { accountType: true } },
          referralCodes: {
            where: { active: true },
            include: {
              product: {
                select: { slug: true, title: true, moderationStatus: true, publishedAt: true },
              },
            },
            take: 50,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!profile?.user.kobaIdentities.some((row) => row.accountType === "INFLUENCER")) {
    return null;
  }
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    codes: profile.user.referralCodes
      .filter((row) => row.product.moderationStatus === "APPROVED" && row.product.publishedAt)
      .map((row) => ({
        code: row.code,
        productSlug: row.product.slug,
        productTitle: row.product.title,
        sharePath: referralSharePath(row.code),
      })),
  };
}

export async function settleReferralForPaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { referralCode: true, influencerEarning: true },
  });
  if (!order?.referralCodeId || !order.referralCode) {
    return null;
  }
  if (order.influencerEarning) {
    return order.influencerEarning;
  }
  if (order.influencerShareCents <= 0) {
    await prisma.referralAttribution.upsert({
      where: { orderId },
      create: {
        orderId,
        referralCodeId: order.referralCodeId,
        influencerUserId: order.referralCode.influencerUserId,
      },
      update: {},
    });
    return null;
  }

  const earning = await prisma.$transaction(async (tx) => {
    await tx.referralAttribution.upsert({
      where: { orderId },
      create: {
        orderId,
        referralCodeId: order.referralCodeId!,
        influencerUserId: order.referralCode!.influencerUserId,
      },
      update: {},
    });
    return tx.influencerEarning.create({
      data: {
        publicRef: generateEarningRef(),
        influencerUserId: order.referralCode!.influencerUserId,
        referralCodeId: order.referralCodeId!,
        orderId,
        amountCents: order.influencerShareCents,
        currency: order.currency,
        status: "ACCRUED",
      },
    });
  });

  await writeAuditLog({
    actorUserId: null,
    action: AuditAction.REFERRAL_ATTRIBUTED,
    targetType: "Order",
    targetId: orderId,
    metadata: { earningRef: earning.publicRef, amountCents: earning.amountCents },
  });
  await writeAuditLog({
    actorUserId: null,
    action: AuditAction.INFLUENCER_EARNING_ACCRUED,
    targetType: "InfluencerEarning",
    targetId: earning.id,
    metadata: { orderId, amountCents: earning.amountCents },
  });

  return earning;
}

export async function voidReferralForRefundedOrder(orderId: string) {
  const earning = await prisma.influencerEarning.findUnique({ where: { orderId } });
  if (!earning) return null;
  if (earning.status === "VOID" || earning.status === "HELD") {
    return earning;
  }
  const next = earning.status === "PAID" ? "HELD" : "VOID";
  const updated = await prisma.influencerEarning.update({
    where: { id: earning.id },
    data: {
      status: next,
      voidedAt: next === "VOID" ? new Date() : earning.voidedAt,
    },
  });
  await writeAuditLog({
    actorUserId: null,
    action: AuditAction.INFLUENCER_EARNING_VOIDED,
    targetType: "InfluencerEarning",
    targetId: earning.id,
    metadata: { orderId, previous: earning.status, next },
  });
  return updated;
}
