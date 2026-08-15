import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import { generateCampaignRef } from "@/features/promotions/lib/refs";
import { requireActiveAccount } from "@/features/promotions/lib/session";
import {
  canTransitionCampaign,
  campaignIsAttributable,
  type AffiliateCampaignStatus,
} from "@/features/promotions/lib/campaign-state";
import { maxCommissionBps, maxDiscountBps } from "@/features/promotions/lib/pricing";
import type { CreateAffiliateCampaignInput } from "@/features/promotions/schemas/promotions.schemas";
import {
  notifyPromotion,
  recordPromotionEvent,
} from "@/features/promotions/services/events.service";

async function ownedShop(userId: string) {
  await requireActiveAccount(userId, "BUSINESS");
  const shop = await prisma.shop.findUnique({
    where: { ownerUserId: userId },
    include: { members: { select: { userId: true } } },
  });
  if (!shop) {
    throw new PromotionError("Create a shop before starting campaigns.", "NOT_FOUND");
  }
  return shop;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PromotionError("Invalid campaign date.", "INVALID");
  }
  return date;
}

function validateRates(input: CreateAffiliateCampaignInput) {
  if (input.commissionType === "PERCENTAGE" && input.commissionValue > maxCommissionBps()) {
    throw new PromotionError("Commission percentage exceeds the configured cap.", "INVALID");
  }
  if (
    input.discountType === "PERCENTAGE" &&
    input.discountValue != null &&
    input.discountValue > maxDiscountBps()
  ) {
    throw new PromotionError("Discount percentage exceeds the configured cap.", "INVALID");
  }
}

export async function createAffiliateCampaign(
  userId: string,
  input: CreateAffiliateCampaignInput,
  ipAddress?: string | null,
) {
  const shop = await ownedShop(userId);
  validateRates(input);
  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new PromotionError("Campaign end must be after start.", "INVALID");
  }
  const products = await prisma.product.findMany({
    where: {
      slug: { in: input.productSlugs },
      shopId: shop.id,
      moderationStatus: "APPROVED",
      publishedAt: { not: null },
    },
    select: { id: true },
  });
  if (products.length === 0) {
    throw new PromotionError("Select at least one approved shop listing.", "NOT_FOUND");
  }

  const created = await prisma.affiliateCampaign.create({
    data: {
      publicRef: generateCampaignRef(),
      shopId: shop.id,
      sellerUserId: userId,
      name: input.name,
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
      discountType: input.discountType ?? null,
      discountValue: input.discountValue ?? null,
      attributionWindowHours: input.attributionWindowHours,
      totalBudgetCents: input.totalBudgetCents,
      remainingBudgetCents: input.totalBudgetCents,
      perInfluencerLimitCents: input.perInfluencerLimitCents ?? null,
      totalConversionLimit: input.totalConversionLimit ?? null,
      targetGames: input.targetGames,
      targetCategories: input.targetCategories,
      openApplications: input.openApplications,
      terms: input.terms,
      startsAt,
      endsAt,
      products: { create: products.map((product) => ({ productId: product.id })) },
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.AFFILIATE_CAMPAIGN_CREATED,
    targetType: "AffiliateCampaign",
    targetId: created.id,
    ipAddress: ipAddress ?? null,
  });
  await recordPromotionEvent({
    type: "campaign.created",
    campaignId: created.id,
    actorUserId: userId,
    idempotencyKey: `campaign-created:${created.id}`,
  });
  return created;
}

export async function getSellerCampaign(userId: string, campaignId: string) {
  await ownedShop(userId);
  const campaign = await prisma.affiliateCampaign.findFirst({
    where: { id: campaignId, sellerUserId: userId },
    include: {
      products: { include: { product: { select: { slug: true, title: true } } } },
      participations: {
        include: {
          influencer: { select: { profile: { select: { handle: true, displayName: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
      promoCodes: { orderBy: { createdAt: "desc" }, take: 50 },
      _count: { select: { commissions: true, clickEvents: true } },
    },
  });
  if (!campaign) throw new PromotionError("Campaign not found.", "NOT_FOUND");
  return campaign;
}

export async function listSellerCampaigns(userId: string) {
  await ownedShop(userId);
  return prisma.affiliateCampaign.findMany({
    where: { sellerUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { participations: true, commissions: true } },
    },
  });
}

export async function transitionSellerCampaign(
  userId: string,
  campaignId: string,
  next: AffiliateCampaignStatus,
) {
  const campaign = await getSellerCampaign(userId, campaignId);
  if (!canTransitionCampaign(campaign.status, next)) {
    throw new PromotionError("That campaign status change is not allowed.", "CONFLICT");
  }
  if (next === "ACTIVE" && campaign.status !== "APPROVED" && campaign.status !== "PAUSED") {
    throw new PromotionError("Staff must approve the campaign before it can go live.", "FORBIDDEN");
  }
  const updated = await prisma.affiliateCampaign.update({
    where: { id: campaign.id },
    data: { status: next },
  });
  await recordPromotionEvent({
    type: "campaign.status",
    campaignId: campaign.id,
    actorUserId: userId,
    payload: { from: campaign.status, to: next },
    idempotencyKey: `campaign-status:${campaign.id}:${campaign.status}:${next}:${updated.updatedAt.toISOString()}`,
  });
  if (next === "SUBMITTED") {
    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.AFFILIATE_CAMPAIGN_SUBMITTED,
      targetType: "AffiliateCampaign",
      targetId: campaign.id,
    });
  }
  if (next === "PAUSED" || next === "COMPLETED") {
    const participants = await prisma.campaignParticipation.findMany({
      where: { campaignId: campaign.id, status: { in: ["ACTIVE", "INVITED", "APPLIED"] } },
      select: { influencerUserId: true },
    });
    for (const row of participants) {
      await notifyPromotion({
        userId: row.influencerUserId,
        type: next === "PAUSED" ? "campaign.paused" : "campaign.completed",
        title: next === "PAUSED" ? "Campaign paused" : "Campaign completed",
        message: "A campaign you joined changed status.",
        href: `/influencer/campaigns/${campaign.id}`,
      });
    }
  }
  return updated;
}

export async function listOpenCampaignsForInfluencer() {
  return prisma.affiliateCampaign.findMany({
    where: { status: "ACTIVE", openApplications: true },
    include: {
      shop: { select: { name: true, slug: true } },
      products: { include: { product: { select: { title: true, slug: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export function campaignCurrentlyAttributable(
  campaign: { status: AffiliateCampaignStatus; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
) {
  return campaignIsAttributable(campaign.status, now, campaign.startsAt, campaign.endsAt);
}
