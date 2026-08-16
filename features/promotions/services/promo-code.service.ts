import type { Prisma } from "@/lib/generated/prisma/client";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import { normalizePromoCode } from "@/features/promotions/lib/tokens";
import { requireActiveAccount } from "@/features/promotions/lib/session";
import { maxDiscountBps, promoDiscountCents } from "@/features/promotions/lib/pricing";
import type { CreatePromoCodeInput } from "@/features/promotions/schemas/promotions.schemas";
import { recordPromotionEvent } from "@/features/promotions/services/events.service";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PromotionError("Invalid promo date.", "INVALID");
  return date;
}

export async function createPromoCode(
  userId: string,
  input: CreatePromoCodeInput,
  ipAddress?: string | null,
) {
  await requireActiveAccount(userId, "BUSINESS");
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) throw new PromotionError("Shop not found.", "NOT_FOUND");
  if (input.discountType === "PERCENTAGE" && input.discountValue > maxDiscountBps()) {
    throw new PromotionError("Discount percentage exceeds the configured cap.", "INVALID");
  }
  const code = normalizePromoCode(input.code);
  if (code.length < 3) throw new PromotionError("Promo code is too short.", "INVALID");
  let campaignId: string | null = null;
  if (input.campaignId) {
    const campaign = await prisma.affiliateCampaign.findFirst({
      where: { id: input.campaignId, sellerUserId: userId },
    });
    if (!campaign) throw new PromotionError("Campaign not found.", "NOT_FOUND");
    campaignId = campaign.id;
  }
  const products = input.productSlugs.length
    ? await prisma.product.findMany({
        where: { slug: { in: input.productSlugs }, shopId: shop.id },
        select: { id: true },
      })
    : [];
  const created = await prisma.promoCode
    .create({
      data: {
        code,
        sellerUserId: userId,
        shopId: shop.id,
        campaignId,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderCents: input.minOrderCents,
        maxDiscountCents: input.maxDiscountCents ?? null,
        usageLimit: input.usageLimit ?? null,
        perAccountLimit: input.perAccountLimit,
        startsAt: parseDate(input.startsAt),
        endsAt: parseDate(input.endsAt),
        applicableAccountTypes: input.applicableAccountTypes,
        products: { create: products.map((product) => ({ productId: product.id })) },
      },
    })
    .catch(() => {
      throw new PromotionError("That promo code already exists.", "CONFLICT");
    });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PROMO_CODE_CREATED,
    targetType: "PromoCode",
    targetId: created.id,
    ipAddress: ipAddress ?? null,
  });
  return created;
}

export async function listSellerPromoCodes(userId: string) {
  await requireActiveAccount(userId, "BUSINESS");
  return prisma.promoCode.findMany({
    where: { sellerUserId: userId },
    include: { products: { include: { product: { select: { slug: true, title: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function suspendPromoCode(actorUserId: string, promoCodeId: string, asStaff = false) {
  const code = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
  if (!code) throw new PromotionError("Promo code not found.", "NOT_FOUND");
  if (!asStaff && code.sellerUserId !== actorUserId) {
    throw new PromotionError("You cannot suspend this promo code.", "FORBIDDEN");
  }
  const updated = await prisma.promoCode.update({
    where: { id: code.id },
    data: { active: false },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditAction.PROMO_CODE_SUSPENDED,
    targetType: "PromoCode",
    targetId: code.id,
  });
  return updated;
}

export type ValidatedPromo = {
  promoCodeId: string;
  code: string;
  discountCents: number;
  campaignId: string | null;
};

export async function validatePromoForProduct(input: {
  code: string;
  productId: string;
  shopId: string;
  buyerUserId: string;
  subtotalCents: number;
  accountType: string;
  now?: Date;
}): Promise<ValidatedPromo> {
  const now = input.now ?? new Date();
  const code = normalizePromoCode(input.code);
  const row = await prisma.promoCode.findUnique({
    where: { code },
    include: { products: true },
  });
  if (!row || !row.active) {
    throw new PromotionError("Promo code is not valid.", "NOT_FOUND");
  }
  if (row.shopId !== input.shopId) {
    throw new PromotionError("Promo code does not apply to this shop.", "FORBIDDEN");
  }
  if (row.startsAt && now < row.startsAt) {
    throw new PromotionError("Promo code is not active yet.", "INVALID");
  }
  if (row.endsAt && now > row.endsAt) {
    throw new PromotionError("Promo code has expired.", "INVALID");
  }
  if (row.products.length > 0 && !row.products.some((item) => item.productId === input.productId)) {
    throw new PromotionError("Promo code does not apply to this listing.", "FORBIDDEN");
  }
  if (
    row.applicableAccountTypes.length > 0 &&
    !row.applicableAccountTypes.includes(input.accountType)
  ) {
    throw new PromotionError("Promo code does not apply to this account type.", "FORBIDDEN");
  }
  if (row.sellerUserId === input.buyerUserId) {
    throw new PromotionError("You cannot use your own promo code.", "SELF_REFERRAL");
  }
  if (input.subtotalCents < row.minOrderCents) {
    throw new PromotionError("Order does not meet the promo minimum.", "INVALID");
  }
  if (row.usageLimit != null && row.usageCount >= row.usageLimit) {
    throw new PromotionError("Promo code usage limit reached.", "CONFLICT");
  }
  const used = await prisma.promoCodeRedemption.count({
    where: { promoCodeId: row.id, userId: input.buyerUserId },
  });
  if (used >= row.perAccountLimit) {
    throw new PromotionError("You have already used this promo code.", "CONFLICT");
  }
  const discountCents = promoDiscountCents({
    subtotalCents: input.subtotalCents,
    type: row.discountType,
    value: row.discountValue,
    maxDiscountCents: row.maxDiscountCents,
  });
  await recordPromotionEvent({
    type: "promo.validated",
    campaignId: row.campaignId,
    actorUserId: input.buyerUserId,
    payload: { code: row.code, discountCents },
    idempotencyKey: `promo-validate:${row.id}:${input.buyerUserId}:${input.productId}:${Math.floor(now.getTime() / 60_000)}`,
  });
  return {
    promoCodeId: row.id,
    code: row.code,
    discountCents,
    campaignId: row.campaignId,
  };
}

export async function redeemPromoInTransaction(
  tx: Prisma.TransactionClient,
  input: { promoCodeId: string; userId: string; orderId: string },
) {
  const locked = await tx.promoCode.findUnique({ where: { id: input.promoCodeId } });
  if (!locked?.active) {
    throw new PromotionError("Promo code is not valid.", "NOT_FOUND");
  }
  if (locked.usageLimit != null && locked.usageCount >= locked.usageLimit) {
    throw new PromotionError("Promo code usage limit reached.", "CONFLICT");
  }
  const used = await tx.promoCodeRedemption.count({
    where: { promoCodeId: locked.id, userId: input.userId },
  });
  if (used >= locked.perAccountLimit) {
    throw new PromotionError("You have already used this promo code.", "CONFLICT");
  }
  const bumped = await tx.promoCode.updateMany({
    where: {
      id: locked.id,
      active: true,
      ...(locked.usageLimit == null ? {} : { usageCount: { lt: locked.usageLimit } }),
    },
    data: { usageCount: { increment: 1 } },
  });
  if (bumped.count !== 1) {
    throw new PromotionError("Promo code usage limit reached.", "CONFLICT");
  }
  await tx.promoCodeRedemption.create({
    data: {
      promoCodeId: locked.id,
      userId: input.userId,
      orderId: input.orderId,
    },
  });
}
