import type { Prisma } from "@/lib/generated/prisma/client";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import { generateSponsoredRef } from "@/features/promotions/lib/refs";
import { visitorHash } from "@/features/promotions/lib/tokens";
import {
  defaultAdCpcCoins,
  adClickIdempotencyKey,
  adImpressionIdempotencyKey,
  adDuplicateWindowMs,
} from "@/features/promotions/lib/fraud";
import {
  selectSponsoredAd,
  isAdvertiserSelfClick,
  type AdContext,
  type SponsoredCandidate,
} from "@/features/promotions/lib/ad-selection";
import { requireActiveAccount } from "@/features/promotions/lib/session";
import type { CreateSponsoredCampaignInput } from "@/features/promotions/schemas/promotions.schemas";
import { reserveCoins, settleReservation } from "@/features/wallet/services/ledger.service";
import {
  notifyPromotion,
  recordPromotionEvent,
} from "@/features/promotions/services/events.service";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PromotionError("Invalid ad date.", "INVALID");
  return date;
}

async function assertEntityOwned(
  userId: string,
  entityType: CreateSponsoredCampaignInput["entityType"],
  entityId: string,
) {
  if (entityType === "PRODUCT") {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: entityId }, { slug: entityId }], shop: { ownerUserId: userId } },
    });
    if (!product) throw new PromotionError("You do not own that listing.", "FORBIDDEN");
    return product.id;
  }
  if (entityType === "SHOP") {
    const shop = await prisma.shop.findFirst({
      where: { OR: [{ id: entityId }, { slug: entityId }], ownerUserId: userId },
    });
    if (!shop) throw new PromotionError("You do not own that shop.", "FORBIDDEN");
    return shop.id;
  }
  if (entityType === "DEV_PRODUCT") {
    const product = await prisma.devProduct.findFirst({
      where: { OR: [{ id: entityId }, { slug: entityId }], ownerUserId: userId },
    });
    if (!product) throw new PromotionError("You do not own that app listing.", "FORBIDDEN");
    return product.id;
  }
  const server = await prisma.gameServer.findFirst({
    where: { OR: [{ id: entityId }, { publicRef: entityId }], ownerUserId: userId },
  });
  if (!server) throw new PromotionError("You do not own that server.", "FORBIDDEN");
  return server.id;
}

export async function createSponsoredCampaign(
  userId: string,
  input: CreateSponsoredCampaignInput,
  ipAddress?: string | null,
) {
  await requireActiveAccount(userId, "BUSINESS");
  const entityId = await assertEntityOwned(userId, input.entityType, input.entityId);
  if (input.dailyBudgetCoins > input.totalBudgetCoins) {
    throw new PromotionError("Daily budget cannot exceed total budget.", "INVALID");
  }
  const cpc = input.cpcCoins ? BigInt(input.cpcCoins) : defaultAdCpcCoins();
  const created = await prisma.sponsoredCampaign.create({
    data: {
      publicRef: generateSponsoredRef(),
      advertiserUserId: userId,
      entityType: input.entityType,
      entityId,
      placement: input.placement,
      targetGameId: input.targetGameId ?? null,
      targetCategoryId: input.targetCategoryId ?? null,
      targetPlatform: input.targetPlatform ?? null,
      targetRegion: input.targetRegion ?? null,
      startsAt: parseDate(input.startsAt),
      endsAt: parseDate(input.endsAt),
      totalBudgetCoins: BigInt(input.totalBudgetCoins),
      remainingBudgetCoins: BigInt(input.totalBudgetCoins),
      dailyBudgetCoins: BigInt(input.dailyBudgetCoins),
      cpcCoins: cpc,
      frequencyCap: input.frequencyCap,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SPONSORED_CAMPAIGN_CREATED,
    targetType: "SponsoredCampaign",
    targetId: created.id,
    ipAddress: ipAddress ?? null,
  });
  return created;
}

export async function listSellerAds(userId: string) {
  await requireActiveAccount(userId, "BUSINESS");
  return prisma.sponsoredCampaign.findMany({
    where: { advertiserUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function submitSponsoredCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.sponsoredCampaign.findFirst({
    where: { id: campaignId, advertiserUserId: userId },
  });
  if (!campaign) throw new PromotionError("Ad campaign not found.", "NOT_FOUND");
  if (campaign.status !== "DRAFT" && campaign.status !== "REJECTED") {
    throw new PromotionError("Only draft ads can be submitted.", "CONFLICT");
  }
  return prisma.sponsoredCampaign.update({
    where: { id: campaign.id },
    data: { status: "SUBMITTED" },
  });
}

export async function activateApprovedAd(userId: string, campaignId: string) {
  const campaign = await prisma.sponsoredCampaign.findFirst({
    where: { id: campaignId, advertiserUserId: userId },
  });
  if (!campaign) throw new PromotionError("Ad campaign not found.", "NOT_FOUND");
  if (campaign.status !== "APPROVED" && campaign.status !== "PAUSED") {
    throw new PromotionError("Staff must approve the ad before it can run.", "FORBIDDEN");
  }
  if (!campaign.reservationPublicRef) {
    const reserved = await reserveCoins({
      userId,
      amount: campaign.totalBudgetCoins,
      purpose: `sponsored:${campaign.publicRef}`,
      idempotencyKey: `ad-reserve:${campaign.id}`,
    });
    await prisma.sponsoredCampaign.update({
      where: { id: campaign.id },
      data: { reservationPublicRef: reserved.publicRef, status: "ACTIVE" },
    });
    return prisma.sponsoredCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
  }
  return prisma.sponsoredCampaign.update({
    where: { id: campaign.id },
    data: { status: "ACTIVE" },
  });
}

export async function cancelOrCompleteAd(
  userId: string,
  campaignId: string,
  next: "CANCELLED" | "COMPLETED" | "PAUSED",
) {
  const campaign = await prisma.sponsoredCampaign.findFirst({
    where: { id: campaignId, advertiserUserId: userId },
  });
  if (!campaign) throw new PromotionError("Ad campaign not found.", "NOT_FOUND");
  if (next === "PAUSED") {
    return prisma.sponsoredCampaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
    });
  }
  if (campaign.reservationPublicRef) {
    await settleReservation({
      userId: campaign.advertiserUserId,
      reservationPublicRef: campaign.reservationPublicRef,
      captureAmount: campaign.spendCoins,
      idempotencyKey: `ad-settle:${campaign.id}`,
    });
    await recordPromotionEvent({
      type: "ad.budget_release",
      campaignId: campaign.id,
      actorUserId: userId,
      payload: { spend: campaign.spendCoins.toString() },
      idempotencyKey: `ad-release:${campaign.id}`,
    });
  }
  return prisma.sponsoredCampaign.update({
    where: { id: campaign.id },
    data: { status: next, remainingBudgetCoins: 0n },
  });
}

function toCandidate(
  row: {
    id: string;
    remainingBudgetCoins: bigint;
    dailyBudgetCoins: bigint;
    dailySpentCoins: bigint;
    dailySpentOn: Date | null;
    cpcCoins: bigint;
    frequencyCap: number;
    targetGameId: string | null;
    targetCategoryId: string | null;
    targetPlatform: string | null;
    targetRegion: string | null;
    status: string;
    startsAt: Date | null;
    endsAt: Date | null;
    lastShownAt: Date | null;
  },
  impressionsForViewer: number,
): SponsoredCandidate {
  return { ...row, impressionsForViewer };
}

export async function pickSponsoredPlacement(input: {
  placement: "MARKETPLACE" | "SHOP" | "APPS" | "SERVERS";
  context: Omit<AdContext, "now">;
  viewerUserId?: string | null;
  ip?: string | null;
}) {
  const now = new Date();
  const campaigns = await prisma.sponsoredCampaign.findMany({
    where: { status: "ACTIVE", placement: input.placement },
    take: 50,
    orderBy: [{ lastShownAt: "asc" }, { id: "asc" }],
  });
  const viewerKey = input.viewerUserId ?? visitorHash(input.ip, now.toISOString().slice(0, 10));
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const candidates: SponsoredCandidate[] = [];
  for (const campaign of campaigns) {
    const impressionsForViewer = await prisma.sponsoredEvent.count({
      where: {
        campaignId: campaign.id,
        type: "IMPRESSION",
        createdAt: { gte: since },
        OR: input.viewerUserId
          ? [{ viewerUserId: input.viewerUserId }, { viewerHash: viewerKey }]
          : [{ viewerHash: viewerKey }],
      },
    });
    candidates.push(toCandidate(campaign, impressionsForViewer));
  }
  const selected = selectSponsoredAd(candidates, { ...input.context, now });
  if (!selected) return null;
  await recordSponsoredImpression({
    campaignId: selected.id,
    viewerUserId: input.viewerUserId ?? null,
    viewerKey,
  });
  return prisma.sponsoredCampaign.findUnique({ where: { id: selected.id } });
}

export async function recordSponsoredImpression(input: {
  campaignId: string;
  viewerUserId: string | null;
  viewerKey: string;
}) {
  const idempotencyKey = adImpressionIdempotencyKey(
    input.campaignId,
    input.viewerKey,
    adDuplicateWindowMs(),
  );
  try {
    await prisma.sponsoredEvent.create({
      data: {
        campaignId: input.campaignId,
        type: "IMPRESSION",
        viewerUserId: input.viewerUserId,
        viewerHash: input.viewerKey,
        idempotencyKey,
      },
    });
    await prisma.sponsoredCampaign.update({
      where: { id: input.campaignId },
      data: { impressionCount: { increment: 1 }, lastShownAt: new Date() },
    });
    await recordPromotionEvent({
      type: "ad.impression",
      campaignId: input.campaignId,
      actorUserId: input.viewerUserId,
      idempotencyKey: `evt:${idempotencyKey}`,
    });
  } catch {
    return;
  }
}

export async function billSponsoredClick(input: {
  campaignId: string;
  viewerUserId: string | null;
  ip?: string | null;
}) {
  const campaign = await prisma.sponsoredCampaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign || campaign.status !== "ACTIVE") {
    throw new PromotionError("Ad is not active.", "NOT_FOUND");
  }
  const viewerKey =
    input.viewerUserId ?? visitorHash(input.ip, new Date().toISOString().slice(0, 10));
  const selfClick = isAdvertiserSelfClick(campaign.advertiserUserId, input.viewerUserId);
  const idempotencyKey = adClickIdempotencyKey(campaign.id, viewerKey, adDuplicateWindowMs());
  const existing = await prisma.sponsoredEvent.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return { billed: false, duplicate: true, suspicious: existing.suspicious };
  }
  const billed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const prior = await tx.sponsoredEvent.findUnique({ where: { idempotencyKey } });
    if (prior) return { billed: false, duplicate: true, suspicious: prior.suspicious };
    const now = new Date();
    const sameDay =
      campaign.dailySpentOn &&
      campaign.dailySpentOn.getUTCFullYear() === now.getUTCFullYear() &&
      campaign.dailySpentOn.getUTCMonth() === now.getUTCMonth() &&
      campaign.dailySpentOn.getUTCDate() === now.getUTCDate();
    const spentToday = sameDay ? campaign.dailySpentCoins : 0n;
    const suspicious = selfClick;
    await tx.sponsoredEvent.create({
      data: {
        campaignId: campaign.id,
        type: "CLICK",
        viewerUserId: input.viewerUserId,
        viewerHash: viewerKey,
        amountCoins: suspicious ? 0n : campaign.cpcCoins,
        idempotencyKey,
        suspicious,
      },
    });
    await tx.sponsoredCampaign.update({
      where: { id: campaign.id },
      data: { clickCount: { increment: 1 } },
    });
    if (suspicious) {
      return { billed: false, duplicate: false, suspicious: true };
    }
    if (campaign.remainingBudgetCoins < campaign.cpcCoins) {
      await tx.sponsoredCampaign.update({
        where: { id: campaign.id },
        data: { status: "COMPLETED" },
      });
      return { billed: false, duplicate: false, suspicious: false };
    }
    if (spentToday + campaign.cpcCoins > campaign.dailyBudgetCoins) {
      return { billed: false, duplicate: false, suspicious: false };
    }
    await tx.sponsoredEvent.create({
      data: {
        campaignId: campaign.id,
        type: "SPEND",
        viewerUserId: input.viewerUserId,
        viewerHash: viewerKey,
        amountCoins: campaign.cpcCoins,
        idempotencyKey: `${idempotencyKey}:spend`,
      },
    });
    await tx.sponsoredCampaign.update({
      where: { id: campaign.id },
      data: {
        remainingBudgetCoins: { decrement: campaign.cpcCoins },
        spendCoins: { increment: campaign.cpcCoins },
        dailySpentCoins: spentToday + campaign.cpcCoins,
        dailySpentOn: now,
      },
    });
    return { billed: true, duplicate: false, suspicious: false };
  });
  if (billed.billed) {
    await recordPromotionEvent({
      type: "ad.spend",
      campaignId: campaign.id,
      actorUserId: input.viewerUserId,
      payload: { cpc: campaign.cpcCoins.toString() },
      idempotencyKey: `evt-spend:${idempotencyKey}`,
    });
    if (campaign.remainingBudgetCoins - campaign.cpcCoins < campaign.cpcCoins * 10n) {
      await notifyPromotion({
        userId: campaign.advertiserUserId,
        type: "ad.budget_low",
        title: "Ad budget low",
        message: "A sponsored campaign is near its remaining KOBA Coin budget.",
        href: "/seller/ads",
      });
    }
  }
  return billed;
}

export async function resolveSponsoredCreative(campaign: {
  entityType: string;
  entityId: string;
  placement: string;
}) {
  if (campaign.entityType === "PRODUCT") {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: campaign.entityId }, { slug: campaign.entityId }] },
      select: { slug: true, title: true },
    });
    if (!product) return null;
    return {
      href: `/market/${product.slug}`,
      title: product.title,
      subtitle: "Marketplace listing",
    };
  }
  if (campaign.entityType === "SHOP") {
    const shop = await prisma.shop.findFirst({
      where: { OR: [{ id: campaign.entityId }, { slug: campaign.entityId }] },
      select: { slug: true, name: true },
    });
    if (!shop) return null;
    return { href: `/shops/${shop.slug}`, title: shop.name, subtitle: "Shop" };
  }
  if (campaign.entityType === "DEV_PRODUCT") {
    const product = await prisma.devProduct.findFirst({
      where: { OR: [{ id: campaign.entityId }, { slug: campaign.entityId }] },
      select: { slug: true, name: true },
    });
    if (!product) return null;
    return { href: `/apps/${product.slug}`, title: product.name, subtitle: "App" };
  }
  const server = await prisma.gameServer.findFirst({
    where: {
      OR: [
        { id: campaign.entityId },
        { publicRef: campaign.entityId },
        { slug: campaign.entityId },
      ],
    },
    select: { slug: true, name: true },
  });
  if (!server) return null;
  return { href: `/servers/${server.slug}`, title: server.name, subtitle: "Game server" };
}

export async function settleCompletedAds(limit = 25) {
  const rows = await prisma.sponsoredCampaign.findMany({
    where: {
      status: { in: ["COMPLETED", "CANCELLED"] },
      reservationPublicRef: { not: null },
    },
    take: limit,
  });
  for (const row of rows) {
    if (!row.reservationPublicRef) continue;
    try {
      await settleReservation({
        userId: row.advertiserUserId,
        reservationPublicRef: row.reservationPublicRef,
        captureAmount: row.spendCoins,
        idempotencyKey: `ad-settle:${row.id}`,
      });
    } catch {
      // Already settled or wallet missing — worker retries later.
    }
  }
  return rows.length;
}
