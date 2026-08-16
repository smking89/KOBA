import { z } from "zod";
import { AIDEN_ASSET_TYPES } from "@/features/aiden/lib/types";
import {
  GAME_PLATFORMS,
  LISTING_TYPES,
  PRODUCT_RARITIES,
} from "@/features/marketplace/lib/catalog";

export const aidenEstimateSchema = z
  .object({
    assetType: z.enum(AIDEN_ASSET_TYPES).default("CONCEPT_IMAGE"),
    width: z.number().int().min(256).max(2048).optional(),
    height: z.number().int().min(256).max(2048).optional(),
    quality: z.enum(["standard", "hd"]).optional(),
    count: z.number().int().min(1).max(1).optional(),
  })
  .strict();

export const createAidenJobSchema = z
  .object({
    prompt: z.string().trim().min(4).max(2000),
    game: z.string().trim().min(1).max(64),
    platform: z.string().trim().min(1).max(32),
    assetType: z.literal("CONCEPT_IMAGE").default("CONCEPT_IMAGE"),
    width: z.number().int().min(256).max(2048).optional(),
    height: z.number().int().min(256).max(2048).optional(),
    quality: z.enum(["standard", "hd"]).optional(),
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

export type CreateAidenJobInput = z.infer<typeof createAidenJobSchema>;
export type AidenEstimateInput = z.infer<typeof aidenEstimateSchema>;

export const aidenJobActionSchema = z
  .object({
    action: z.enum(["cancel"]),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export type AidenJobActionInput = z.infer<typeof aidenJobActionSchema>;

/** Marketplace-required fields not already known from the AidenAsset
 * itself (title/description come from the asset — see
 * publishAssetToMarketplace) — the rest is exactly what
 * upsertProductSchema needs, since publishing creates a real Product. */
export const publishAidenAssetSchema = z.object({
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

export type PublishAidenAssetInput = z.infer<typeof publishAidenAssetSchema>;
