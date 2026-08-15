import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import {
  canStaffModeratePromotions,
  canStaffVerifyInfluencer,
} from "@/features/promotions/lib/access";
import { canTransitionCampaign } from "@/features/promotions/lib/campaign-state";
import {
  notifyPromotion,
  recordPromotionEvent,
} from "@/features/promotions/services/events.service";
import { staffSetCommissionStatus } from "@/features/promotions/services/commission.service";
import { staffSetInfluencerVerification } from "@/features/promotions/services/profile.service";
import { suspendPromoCode } from "@/features/promotions/services/promo-code.service";

async function requirePromotionStaff(actorUserId: string, verify = false) {
  const snapshot = await getAccountSnapshot(actorUserId);
  const types = snapshot?.identities.map((row) => row.accountType) ?? [];
  const allowed = verify ? canStaffVerifyInfluencer(types) : canStaffModeratePromotions(types);
  if (!snapshot || !allowed) {
    throw new PromotionError("Staff permission required.", "FORBIDDEN");
  }
  return snapshot;
}

export async function listStaffPromotionQueue() {
  const [campaigns, ads, influencers, commissions] = await Promise.all([
    prisma.affiliateCampaign.findMany({
      where: { status: { in: ["SUBMITTED", "ACTIVE", "SUSPENDED"] } },
      include: { shop: { select: { name: true, slug: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.sponsoredCampaign.findMany({
      where: { status: { in: ["SUBMITTED", "ACTIVE", "SUSPENDED"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.influencerProfile.findMany({
      where: { verificationStatus: { in: ["PENDING", "SUSPENDED"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.promotionCommission.findMany({
      where: { status: "UNDER_REVIEW" },
      include: { order: { select: { publicRef: true } } },
      take: 50,
    }),
  ]);
  return { campaigns, ads, influencers, commissions };
}

export async function staffModerateAffiliateCampaign(input: {
  actorUserId: string;
  campaignId: string;
  action: "approve" | "reject" | "suspend";
  note?: string;
}) {
  await requirePromotionStaff(input.actorUserId, input.action === "approve");
  const campaign = await prisma.affiliateCampaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) throw new PromotionError("Campaign not found.", "NOT_FOUND");
  const next =
    input.action === "approve" ? "APPROVED" : input.action === "reject" ? "REJECTED" : "SUSPENDED";
  if (!canTransitionCampaign(campaign.status, next) && campaign.status !== "ACTIVE") {
    throw new PromotionError("That campaign moderation action is not allowed.", "CONFLICT");
  }
  const updated = await prisma.affiliateCampaign.update({
    where: { id: campaign.id },
    data: { status: next, moderationNote: input.note ?? campaign.moderationNote },
  });
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: AuditAction.AFFILIATE_CAMPAIGN_MODERATED,
    targetType: "AffiliateCampaign",
    targetId: campaign.id,
    metadata: { action: input.action },
  });
  await notifyPromotion({
    userId: campaign.sellerUserId,
    type: "moderation",
    title: "Campaign moderation",
    message: "Staff updated an affiliate campaign.",
    href: `/seller/promotions/${campaign.id}`,
  });
  return updated;
}

export async function staffModerateAd(input: {
  actorUserId: string;
  campaignId: string;
  action: "approve" | "reject" | "suspend";
  note?: string;
}) {
  await requirePromotionStaff(input.actorUserId, input.action === "approve");
  const campaign = await prisma.sponsoredCampaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) throw new PromotionError("Ad campaign not found.", "NOT_FOUND");
  const next =
    input.action === "approve" ? "APPROVED" : input.action === "reject" ? "REJECTED" : "SUSPENDED";
  const updated = await prisma.sponsoredCampaign.update({
    where: { id: campaign.id },
    data: { status: next, moderationNote: input.note ?? campaign.moderationNote },
  });
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: AuditAction.SPONSORED_CAMPAIGN_MODERATED,
    targetType: "SponsoredCampaign",
    targetId: campaign.id,
    metadata: { action: input.action },
  });
  await notifyPromotion({
    userId: campaign.advertiserUserId,
    type: "moderation",
    title: "Ad moderation",
    message: "Staff updated a sponsored campaign.",
    href: "/seller/ads",
  });
  await recordPromotionEvent({
    type: "ad.moderated",
    campaignId: campaign.id,
    actorUserId: input.actorUserId,
    payload: { action: input.action },
    idempotencyKey: `ad-mod:${campaign.id}:${input.action}:${Date.now()}`,
  });
  return updated;
}

export async function staffMarkClickSuspicious(
  actorUserId: string,
  clickId: string,
  note?: string,
) {
  await requirePromotionStaff(actorUserId);
  const click = await prisma.referralClickEvent.update({
    where: { id: clickId },
    data: { suspicious: true },
  });
  await recordPromotionEvent({
    type: "referral.suspicious",
    campaignId: click.campaignId,
    participationId: click.participationId,
    actorUserId,
    payload: { note: note ?? null },
    idempotencyKey: `click-flag:${click.id}`,
  });
  return click;
}

export { staffSetCommissionStatus, staffSetInfluencerVerification, suspendPromoCode };
