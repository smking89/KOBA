import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import { generateParticipationRef } from "@/features/promotions/lib/refs";
import { generateReferralToken } from "@/features/promotions/lib/tokens";
import { requireActiveAccount } from "@/features/promotions/lib/session";
import {
  canTransitionParticipation,
  participationIsAttributable,
  type CampaignParticipationStatus,
} from "@/features/promotions/lib/campaign-state";
import { ensureInfluencerProfile } from "@/features/promotions/services/profile.service";
import {
  notifyPromotion,
  recordPromotionEvent,
} from "@/features/promotions/services/events.service";

async function assertNotSelfShop(influencerUserId: string, shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { members: { select: { userId: true } } },
  });
  if (!shop) throw new PromotionError("Shop not found.", "NOT_FOUND");
  if (
    shop.ownerUserId === influencerUserId ||
    shop.members.some((row) => row.userId === influencerUserId)
  ) {
    throw new PromotionError("You cannot join a campaign for your own shop.", "SELF_REFERRAL");
  }
  return shop;
}

async function writeParticipationChange(
  actorUserId: string,
  participation: { id: string; campaignId: string; status: string },
  next: CampaignParticipationStatus,
) {
  await writeAuditLog({
    actorUserId,
    action: AuditAction.CAMPAIGN_PARTICIPATION_CHANGED,
    targetType: "CampaignParticipation",
    targetId: participation.id,
    metadata: { from: participation.status, to: next },
  });
  await recordPromotionEvent({
    type: "participation.status",
    campaignId: participation.campaignId,
    participationId: participation.id,
    actorUserId,
    payload: { from: participation.status, to: next },
    idempotencyKey: `part:${participation.id}:${participation.status}:${next}:${Date.now()}`,
  });
}

export async function applyToCampaign(
  influencerUserId: string,
  campaignId: string,
  acceptTerms: boolean,
) {
  await requireActiveAccount(influencerUserId, "INFLUENCER");
  const profile = await ensureInfluencerProfile(influencerUserId);
  if (profile.suspendedAt) {
    throw new PromotionError("Suspended influencers cannot apply.", "FORBIDDEN");
  }
  const campaign = await prisma.affiliateCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "ACTIVE") {
    throw new PromotionError("Campaign is not accepting applications.", "NOT_FOUND");
  }
  if (!campaign.openApplications) {
    throw new PromotionError("This campaign is invite-only.", "FORBIDDEN");
  }
  if (!acceptTerms) {
    throw new PromotionError("You must accept the campaign terms.", "INVALID");
  }
  await assertNotSelfShop(influencerUserId, campaign.shopId);
  const existing = await prisma.campaignParticipation.findUnique({
    where: { campaignId_influencerUserId: { campaignId, influencerUserId } },
  });
  if (existing) return existing;
  const created = await prisma.campaignParticipation.create({
    data: {
      publicRef: generateParticipationRef(),
      campaignId,
      influencerUserId,
      status: "APPLIED",
      referralToken: generateReferralToken(),
      termsAcceptedAt: new Date(),
    },
  });
  await notifyPromotion({
    userId: campaign.sellerUserId,
    type: "application",
    title: "Influencer applied",
    message: "An influencer applied to your campaign.",
    href: `/seller/promotions/${campaign.id}`,
  });
  await writeParticipationChange(influencerUserId, created, "APPLIED");
  return created;
}

export async function inviteInfluencer(sellerUserId: string, campaignId: string, handle: string) {
  await requireActiveAccount(sellerUserId, "BUSINESS");
  const campaign = await prisma.affiliateCampaign.findFirst({
    where: { id: campaignId, sellerUserId },
  });
  if (!campaign) throw new PromotionError("Campaign not found.", "NOT_FOUND");
  const account = await prisma.accountProfile.findUnique({
    where: { handle: handle.trim().toLowerCase() },
    include: { user: { include: { kobaIdentities: { select: { accountType: true } } } } },
  });
  if (!account?.user.kobaIdentities.some((row) => row.accountType === "INFLUENCER")) {
    throw new PromotionError("Influencer handle not found.", "NOT_FOUND");
  }
  await assertNotSelfShop(account.userId, campaign.shopId);
  const existing = await prisma.campaignParticipation.findUnique({
    where: { campaignId_influencerUserId: { campaignId, influencerUserId: account.userId } },
  });
  if (existing) return existing;
  const created = await prisma.campaignParticipation.create({
    data: {
      publicRef: generateParticipationRef(),
      campaignId,
      influencerUserId: account.userId,
      status: "INVITED",
      referralToken: generateReferralToken(),
    },
  });
  await notifyPromotion({
    userId: account.userId,
    type: "invitation",
    title: "Campaign invitation",
    message: "A seller invited you to promote a campaign.",
    href: `/influencer/campaigns/${campaign.id}`,
  });
  await writeParticipationChange(sellerUserId, created, "INVITED");
  return created;
}

export async function influencerRespond(
  influencerUserId: string,
  participationId: string,
  next: CampaignParticipationStatus,
  acceptTerms?: boolean,
) {
  await requireActiveAccount(influencerUserId, "INFLUENCER");
  const participation = await prisma.campaignParticipation.findFirst({
    where: { id: participationId, influencerUserId },
    include: { campaign: true },
  });
  if (!participation) throw new PromotionError("Participation not found.", "NOT_FOUND");
  if (!canTransitionParticipation(participation.status, next)) {
    throw new PromotionError("That participation change is not allowed.", "CONFLICT");
  }
  if (next === "ACTIVE" && !acceptTerms && !participation.termsAcceptedAt) {
    throw new PromotionError("Accept campaign terms before joining.", "INVALID");
  }
  const updated = await prisma.campaignParticipation.update({
    where: { id: participation.id },
    data: {
      status: next,
      termsAcceptedAt: next === "ACTIVE" ? new Date() : participation.termsAcceptedAt,
    },
  });
  await writeParticipationChange(influencerUserId, participation, next);
  await notifyPromotion({
    userId: participation.campaign.sellerUserId,
    type: "participation",
    title: next === "ACTIVE" ? "Invitation accepted" : "Invitation updated",
    message: "An influencer updated campaign participation.",
    href: `/seller/promotions/${participation.campaignId}`,
  });
  return updated;
}

export async function sellerSetParticipation(
  sellerUserId: string,
  participationId: string,
  next: CampaignParticipationStatus,
) {
  await requireActiveAccount(sellerUserId, "BUSINESS");
  const participation = await prisma.campaignParticipation.findFirst({
    where: { id: participationId, campaign: { sellerUserId } },
    include: { campaign: true },
  });
  if (!participation) throw new PromotionError("Participation not found.", "NOT_FOUND");
  if (!canTransitionParticipation(participation.status, next)) {
    throw new PromotionError("That participation change is not allowed.", "CONFLICT");
  }
  const updated = await prisma.campaignParticipation.update({
    where: { id: participation.id },
    data: { status: next },
  });
  await writeParticipationChange(sellerUserId, participation, next);
  await notifyPromotion({
    userId: participation.influencerUserId,
    type: next === "ACTIVE" ? "application.accepted" : "application.rejected",
    title: next === "ACTIVE" ? "Application accepted" : "Participation updated",
    message: "A seller updated your campaign participation.",
    href: `/influencer/campaigns/${participation.campaignId}`,
  });
  return updated;
}

export async function listInfluencerParticipations(userId: string) {
  await requireActiveAccount(userId, "INFLUENCER");
  return prisma.campaignParticipation.findMany({
    where: { influencerUserId: userId },
    include: {
      campaign: { include: { shop: { select: { name: true, slug: true } } } },
      promoCode: { select: { code: true, active: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function isAuthorizedParticipant(status: CampaignParticipationStatus): boolean {
  return participationIsAttributable(status);
}
