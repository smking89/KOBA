import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { PromotionError } from "@/features/promotions/lib/errors";
import {
  campaignIsAttributable,
  participationIsAttributable,
} from "@/features/promotions/lib/campaign-state";
import {
  chooseAttribution,
  type AttributionCandidate,
} from "@/features/promotions/lib/attribution";
import {
  sanitizeRedirectPath,
  isSafeInternalPath,
  productRedirectPath,
} from "@/features/promotions/lib/redirects";
import {
  ATTRIBUTION_COOKIE,
  REFERRAL_COOKIE,
  attributionWindowHours,
  clickBurstLimit,
  signAttributionCookie,
  readSignedAttributionCookie,
  visitorHash,
} from "@/features/promotions/lib/tokens";
import {
  clickBurstWindowMs,
  clickHashRetentionHours,
  clickIdempotencyKey,
} from "@/features/promotions/lib/fraud";
import { generateClickRef } from "@/features/promotions/lib/refs";
import { recordPromotionEvent } from "@/features/promotions/services/events.service";
import { REFERRAL_COOKIE as LEGACY_COOKIE } from "@/features/influencer/lib/types";

export { ATTRIBUTION_COOKIE, REFERRAL_COOKIE };

export async function resolveCampaignReferral(token: string) {
  const participation = await prisma.campaignParticipation.findUnique({
    where: { referralToken: token },
    include: {
      campaign: {
        include: {
          products: {
            include: {
              product: { select: { slug: true, publishedAt: true, moderationStatus: true } },
            },
          },
        },
      },
      influencer: { select: { id: true } },
    },
  });
  if (!participation) return null;
  if (!participationIsAttributable(participation.status)) return null;
  const now = new Date();
  if (
    !campaignIsAttributable(
      participation.campaign.status,
      now,
      participation.campaign.startsAt,
      participation.campaign.endsAt,
    )
  ) {
    return null;
  }
  const product = participation.campaign.products.find(
    (row) => row.product.moderationStatus === "APPROVED" && row.product.publishedAt,
  );
  const destination = product ? productRedirectPath(product.product.slug) : "/market";
  return { participation, destination };
}

export async function recordCampaignReferralClick(input: {
  token: string;
  destinationPath: string;
  ip?: string | null;
  requestUrl: string;
}) {
  const resolved = await resolveCampaignReferral(input.token);
  if (!resolved) {
    throw new PromotionError("Referral is not active.", "NOT_FOUND");
  }
  const destination = sanitizeRedirectPath(
    isSafeInternalPath(input.destinationPath) ? input.destinationPath : resolved.destination,
  );
  const dayKey = new Date().toISOString().slice(0, 10);
  const hash = visitorHash(input.ip, dayKey);
  const windowMs = clickBurstWindowMs();
  const since = new Date(Date.now() - windowMs);
  const burst = await prisma.referralClickEvent.count({
    where: { visitorHash: hash, createdAt: { gte: since } },
  });
  const suspicious = burst >= clickBurstLimit();
  const idempotencyKey = clickIdempotencyKey(input.token, hash, windowMs);
  const expiresAt = new Date(Date.now() + clickHashRetentionHours() * 60 * 60 * 1000);
  try {
    await prisma.referralClickEvent.create({
      data: {
        publicRef: generateClickRef(),
        participationId: resolved.participation.id,
        campaignId: resolved.participation.campaignId,
        visitorHash: hash,
        destinationPath: destination,
        idempotencyKey,
        suspicious,
        expiresAt,
      },
    });
  } catch {
    // Duplicate click in the same burst window — cookie is still set.
  }
  await recordPromotionEvent({
    type: "referral.click",
    campaignId: resolved.participation.campaignId,
    participationId: resolved.participation.id,
    payload: { suspicious },
    idempotencyKey: `evt:${idempotencyKey}`,
  });
  const windowHours = attributionWindowHours(
    resolved.participation.campaign.attributionWindowHours,
  );
  const signed = signAttributionCookie(
    resolved.participation.referralToken,
    Date.now() + windowHours * 60 * 60 * 1000,
  );
  return {
    destination,
    cookie: signed,
    maxAge: windowHours * 60 * 60,
    requestUrl: input.requestUrl,
  };
}

export async function resolveCheckoutAttribution(input: {
  buyerUserId: string;
  productId: string;
  shopId: string;
  shopOwnerUserId: string;
  promoCampaignId?: string | null;
  promoCodeId?: string | null;
  cookieToken?: string | null;
  checkoutStartedAt: Date;
  now?: Date;
}): Promise<{
  campaignId: string;
  participationId: string;
  influencerUserId: string;
  source: "CLICK" | "PROMO_CODE";
} | null> {
  const now = input.now ?? new Date();
  async function loadCandidate(
    token: string | null | undefined,
    source: "CLICK" | "PROMO_CODE",
  ): Promise<AttributionCandidate | null> {
    if (!token) return null;
    const participation = await prisma.campaignParticipation.findUnique({
      where: { referralToken: token },
      include: { campaign: { include: { products: true } } },
    });
    if (!participation || !participationIsAttributable(participation.status)) return null;
    if (participation.campaign.shopId !== input.shopId) return null;
    if (
      participation.campaign.products.length > 0 &&
      !participation.campaign.products.some((row) => row.productId === input.productId)
    ) {
      return null;
    }
    if (
      !campaignIsAttributable(
        participation.campaign.status,
        now,
        participation.campaign.startsAt,
        participation.campaign.endsAt,
      )
    ) {
      return null;
    }
    const lastClick = await prisma.referralClickEvent.findFirst({
      where: { participationId: participation.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      participationId: participation.id,
      campaignId: participation.campaignId,
      influencerUserId: participation.influencerUserId,
      sellerUserId: participation.campaign.sellerUserId,
      clickedAt: lastClick?.createdAt ?? participation.createdAt,
      windowHours: attributionWindowHours(participation.campaign.attributionWindowHours),
      source,
    };
  }

  let promoToken: string | null = null;
  if (input.promoCodeId) {
    const assigned = await prisma.campaignParticipation.findFirst({
      where: { promoCodeId: input.promoCodeId, status: "ACTIVE" },
    });
    promoToken = assigned?.referralToken ?? null;
  }

  const chosen = chooseAttribution({
    click: await loadCandidate(input.cookieToken, "CLICK"),
    promo: await loadCandidate(promoToken, "PROMO_CODE"),
    buyerUserId: input.buyerUserId,
    now,
    checkoutStartedAt: input.checkoutStartedAt,
  });
  if (!chosen) return null;
  if (chosen.influencerUserId === input.shopOwnerUserId) return null;
  return {
    campaignId: chosen.campaignId,
    participationId: chosen.participationId,
    influencerUserId: chosen.influencerUserId,
    source: chosen.source,
  };
}

export async function readAttributionTokenFromCookies() {
  const store = await cookies();
  const signed = store.get(ATTRIBUTION_COOKIE)?.value;
  const token = readSignedAttributionCookie(signed);
  const legacy = store.get(LEGACY_COOKIE)?.value ?? store.get(REFERRAL_COOKIE)?.value ?? null;
  return { campaignToken: token, legacyCode: legacy };
}
