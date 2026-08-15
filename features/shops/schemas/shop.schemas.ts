import { z } from "zod";
import {
  GAME_PLATFORMS,
  LISTING_TYPES,
  PRODUCT_RARITIES,
} from "@/features/marketplace/lib/catalog";

export const createShopSchema = z.object({
  name: z.string().trim().min(2).max(64),
  bio: z.string().trim().min(8).max(500),
});

export const updateShopSchema = createShopSchema.partial();

export const shopReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(8).max(1000),
});

export const upsertProductSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(12).max(4000),
  rarity: z.enum(PRODUCT_RARITIES),
  listingType: z.enum(LISTING_TYPES),
  priceCents: z.number().int().min(0).max(10_000_000),
  inventoryQty: z.number().int().min(0).max(100_000),
  gameSlug: z.string().trim().min(1).max(64),
  categorySlug: z.string().trim().min(1).max(64),
  platforms: z.array(z.enum(GAME_PLATFORMS)).min(1).max(4),
  durationHours: z.number().int().min(1).max(168),
  minIncrementCents: z.number().int().min(100).max(1_000_000),
});

export type UpsertProductInput = z.infer<typeof upsertProductSchema>;

export const staffVerifyShopSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  note: z.string().trim().max(280).optional(),
});

export const promoConfigUpdateSchema = z
  .object({
    influencerEligible: z.boolean().optional(),
    payoutType: z.enum(["PERCENT", "FIXED"]).optional(),
    payoutValue: z.number().int().min(0).optional(),
  })
  .refine(
    (value) =>
      value.payoutType !== "PERCENT" ||
      value.payoutValue === undefined ||
      value.payoutValue <= 10000,
    {
      message: "PERCENT payoutValue is basis points and must be between 0 and 10000.",
      path: ["payoutValue"],
    },
  );

export type PromoConfigUpdateInput = z.infer<typeof promoConfigUpdateSchema>;
