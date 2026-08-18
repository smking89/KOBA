import { z } from "zod";
import {
  PROMOTION_RATE_TYPES,
  maxCommissionBps,
  maxDiscountBps,
} from "@/features/promotions/lib/pricing";

const slugList = z.array(z.string().trim().min(1).max(96)).max(50);
const stringList = z.array(z.string().trim().min(1).max(48)).max(20);

export const updateInfluencerProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(48),
  bio: z.string().trim().max(2000).default(""),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  bannerUrl: z.string().url().max(500).optional().nullable(),
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(32),
        url: z.string().url().max(300),
      }),
    )
    .max(8)
    .default([]),
  games: stringList.default([]),
  categories: stringList.default([]),
  audienceRegions: stringList.default([]),
  contactEmail: z.string().email().max(160).optional().nullable(),
  acceptDisclosure: z.boolean().optional(),
});

export const createAffiliateCampaignSchema = z.object({
  name: z.string().trim().min(3).max(80),
  productSlugs: slugList.min(1),
  commissionType: z.enum(PROMOTION_RATE_TYPES),
  commissionValue: z.number().int().min(0).max(100_000_000),
  discountType: z.enum(PROMOTION_RATE_TYPES).optional().nullable(),
  discountValue: z.number().int().min(0).max(100_000_000).optional().nullable(),
  attributionWindowHours: z.number().int().min(1).max(720).default(168),
  totalBudgetCents: z.number().int().min(0).max(100_000_000_000),
  perInfluencerLimitCents: z.number().int().min(0).max(100_000_000_000).optional().nullable(),
  totalConversionLimit: z.number().int().min(1).max(1_000_000).optional().nullable(),
  targetGames: stringList.default([]),
  targetCategories: stringList.default([]),
  openApplications: z.boolean().default(true),
  terms: z.string().trim().max(8000).default(""),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const campaignActionSchema = z.object({
  action: z.enum(["submit", "activate", "pause", "complete", "cancel"]),
});

export const inviteInfluencerSchema = z.object({
  handle: z.string().trim().min(2).max(48),
});

export const participationActionSchema = z.object({
  action: z.enum(["accept", "reject", "revoke", "pause", "resume", "apply"]),
  acceptTerms: z.boolean().optional(),
});

export const createPromoCodeSchema = z.object({
  code: z.string().trim().min(3).max(32),
  campaignId: z.string().trim().min(8).max(64).optional().nullable(),
  productSlugs: slugList.default([]),
  discountType: z.enum(PROMOTION_RATE_TYPES),
  discountValue: z.number().int().min(0).max(100_000_000),
  minOrderCents: z.number().int().min(0).max(100_000_000).default(0),
  maxDiscountCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  usageLimit: z.number().int().min(1).max(1_000_000).optional().nullable(),
  perAccountLimit: z.number().int().min(1).max(100).default(1),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  applicableAccountTypes: z.array(z.enum(["PLAYER", "BUSINESS", "INFLUENCER"])).default([]),
});

export const validatePromoSchema = z.object({
  code: z.string().trim().min(3).max(32),
  productSlug: z.string().trim().min(1).max(96),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const createSponsoredCampaignSchema = z.object({
  entityType: z.enum([
    "PRODUCT",
    "SHOP",
    "DEV_PRODUCT",
    "GAME_SERVER",
    "GROUP",
    "INFLUENCER",
    "LFG",
    "COSMETIC",
  ]),
  entityId: z.string().trim().min(1).max(96),
  placement: z.enum(["MARKETPLACE", "SHOP", "APPS", "SERVERS", "FEED"]),
  targetGameId: z.string().trim().max(64).optional().nullable(),
  targetCategoryId: z.string().trim().max(64).optional().nullable(),
  targetPlatform: z.string().trim().max(32).optional().nullable(),
  targetRegion: z.string().trim().max(32).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  totalBudgetCoins: z.number().int().min(1).max(100_000_000),
  dailyBudgetCoins: z.number().int().min(1).max(100_000_000),
  cpcCoins: z.number().int().min(1).max(10_000).optional(),
  frequencyCap: z.number().int().min(1).max(50).default(6),
});

export const sponsoredActionSchema = z.object({
  action: z.enum(["submit", "activate", "pause", "complete", "cancel"]),
});

export const staffPromotionActionSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "suspend",
    "verify",
    "unverify",
    "reverse",
    "review",
    "mark_suspicious",
  ]),
  note: z.string().trim().max(500).optional(),
});

export function assertCommissionWithinLimits(type: "FIXED" | "PERCENTAGE", value: number) {
  if (type === "PERCENTAGE" && value > maxCommissionBps()) {
    throw new Error("Commission percentage exceeds the configured cap.");
  }
}

export function assertDiscountWithinLimits(type: "FIXED" | "PERCENTAGE", value: number) {
  if (type === "PERCENTAGE" && value > maxDiscountBps()) {
    throw new Error("Discount percentage exceeds the configured cap.");
  }
}

export type UpdateInfluencerProfileInput = z.infer<typeof updateInfluencerProfileSchema>;
export type CreateAffiliateCampaignInput = z.infer<typeof createAffiliateCampaignSchema>;
export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;
export type CreateSponsoredCampaignInput = z.infer<typeof createSponsoredCampaignSchema>;
