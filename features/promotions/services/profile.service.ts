import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { PromotionError } from "@/features/promotions/lib/errors";
import { slugifyInfluencer } from "@/features/promotions/lib/refs";
import { requireActiveAccount } from "@/features/promotions/lib/session";
import { canStaffVerifyInfluencer } from "@/features/promotions/lib/access";
import type { UpdateInfluencerProfileInput } from "@/features/promotions/schemas/promotions.schemas";
import {
  notifyPromotion,
  recordPromotionEvent,
} from "@/features/promotions/services/events.service";

function parseSocialLinks(raw: string): Array<{ label: string; url: string }> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is { label: string; url: string } =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as { label?: unknown }).label === "string" &&
        typeof (row as { url?: unknown }).url === "string",
    );
  } catch {
    return [];
  }
}

async function allocateSlug(base: string, userId: string): Promise<string> {
  const root = slugifyInfluencer(base);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const slug = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const clash = await prisma.influencerProfile.findUnique({ where: { slug } });
    if (!clash || clash.userId === userId) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function ensureInfluencerProfile(userId: string) {
  const snapshot = await requireActiveAccount(userId, "INFLUENCER");
  const existing = await prisma.influencerProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  const slug = await allocateSlug(snapshot.handle || snapshot.displayName || "creator", userId);
  return prisma.influencerProfile.create({
    data: {
      userId,
      slug,
      displayName: snapshot.displayName || snapshot.handle,
    },
  });
}

export async function getInfluencerProfile(userId: string) {
  await requireActiveAccount(userId, "INFLUENCER");
  const profile = await ensureInfluencerProfile(userId);
  const [clicks, conversions, commissions] = await Promise.all([
    prisma.referralClickEvent.count({
      where: { participation: { influencerUserId: userId } },
    }),
    prisma.promotionCommission.count({
      where: { influencerUserId: userId, status: { notIn: ["CANCELLED", "REVERSED"] } },
    }),
    prisma.promotionCommission.groupBy({
      by: ["status", "currency"],
      where: { influencerUserId: userId },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    ...profile,
    socialLinks: parseSocialLinks(profile.socialLinksJson),
    publicStats: { clicks, conversions },
    commissions,
    suspended: Boolean(profile.suspendedAt),
  };
}

export async function updateInfluencerProfile(
  userId: string,
  input: UpdateInfluencerProfileInput,
  ipAddress?: string | null,
) {
  const current = await ensureInfluencerProfile(userId);
  if (current.suspendedAt) {
    throw new PromotionError("This influencer profile is suspended.", "FORBIDDEN");
  }
  const slug = current.slug || (await allocateSlug(input.displayName, userId));
  const updated = await prisma.influencerProfile.update({
    where: { userId },
    data: {
      slug,
      displayName: input.displayName,
      bio: input.bio,
      avatarUrl: input.avatarUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      socialLinksJson: JSON.stringify(input.socialLinks),
      games: input.games,
      categories: input.categories,
      audienceRegions: input.audienceRegions,
      contactEmail: input.contactEmail ?? null,
      disclosureAcceptedAt: input.acceptDisclosure ? new Date() : current.disclosureAcceptedAt,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.INFLUENCER_PROFILE_UPDATED,
    targetType: "InfluencerProfile",
    targetId: updated.id,
    ipAddress: ipAddress ?? null,
  });
  return updated;
}

export async function requestInfluencerVerification(userId: string) {
  const profile = await ensureInfluencerProfile(userId);
  if (profile.suspendedAt) {
    throw new PromotionError("Suspended profiles cannot request verification.", "FORBIDDEN");
  }
  if (profile.verificationStatus === "VERIFIED") {
    return profile;
  }
  if (profile.verificationStatus === "PENDING") {
    return profile;
  }
  return prisma.influencerProfile.update({
    where: { userId },
    data: { verificationStatus: "PENDING" },
  });
}

export async function staffSetInfluencerVerification(input: {
  actorUserId: string;
  slug: string;
  status: "VERIFIED" | "REJECTED" | "SUSPENDED" | "UNVERIFIED";
  note?: string;
  payoutEligible?: boolean;
}) {
  const snapshot = await getAccountSnapshot(input.actorUserId);
  if (!snapshot || !canStaffVerifyInfluencer(snapshot.identities.map((row) => row.accountType))) {
    throw new PromotionError("Staff verification permission required.", "FORBIDDEN");
  }
  const profile = await prisma.influencerProfile.findUnique({ where: { slug: input.slug } });
  if (!profile) throw new PromotionError("Influencer profile not found.", "NOT_FOUND");
  const updated = await prisma.influencerProfile.update({
    where: { id: profile.id },
    data: {
      verificationStatus: input.status,
      verificationNote: input.note ?? profile.verificationNote,
      suspendedAt: input.status === "SUSPENDED" ? new Date() : null,
      payoutEligible: input.status === "VERIFIED" ? Boolean(input.payoutEligible) : false,
    },
  });
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action:
      input.status === "SUSPENDED"
        ? AuditAction.INFLUENCER_SUSPENDED
        : AuditAction.INFLUENCER_VERIFIED,
    targetType: "InfluencerProfile",
    targetId: updated.id,
    metadata: { status: input.status },
  });
  await notifyPromotion({
    userId: profile.userId,
    type: "moderation",
    title: "Influencer verification updated",
    message: "Staff updated your influencer verification status.",
    href: "/influencer/profile",
  });
  await recordPromotionEvent({
    type: "influencer.moderated",
    actorUserId: input.actorUserId,
    payload: { status: input.status },
    idempotencyKey: `inf-mod:${profile.id}:${input.status}:${Date.now()}`,
  });
  return updated;
}

export async function getPublicInfluencerProfile(slug: string) {
  const profile = await prisma.influencerProfile.findUnique({
    where: { slug: slug.trim().toLowerCase() },
  });
  if (!profile || profile.suspendedAt || profile.verificationStatus === "SUSPENDED") {
    return null;
  }
  const [clicks, conversions, activeCampaigns] = await Promise.all([
    prisma.referralClickEvent.count({
      where: { participation: { influencerUserId: profile.userId } },
    }),
    prisma.promotionCommission.count({
      where: {
        influencerUserId: profile.userId,
        status: { in: ["PENDING", "QUALIFIED", "AVAILABLE", "PAID"] },
      },
    }),
    prisma.campaignParticipation.count({
      where: { influencerUserId: profile.userId, status: "ACTIVE" },
    }),
  ]);
  return {
    slug: profile.slug,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
    socialLinks: parseSocialLinks(profile.socialLinksJson),
    games: profile.games,
    categories: profile.categories,
    audienceRegions: profile.audienceRegions,
    verificationStatus: profile.verificationStatus,
    stats: { clicks, conversions, activeCampaigns },
  };
}
