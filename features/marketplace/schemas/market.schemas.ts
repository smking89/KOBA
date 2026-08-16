import { z } from "zod";
import {
  GAME_PLATFORMS,
  LISTING_TYPES,
  MARKET_SORTS,
  MAX_PAGE_SIZE,
  PAGE_SIZE,
  PRODUCT_RARITIES,
} from "@/features/marketplace/lib/catalog";

export const marketQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  game: z.string().trim().max(64).optional(),
  category: z.string().trim().max(64).optional(),
  rarity: z.enum(PRODUCT_RARITIES).optional(),
  platform: z.enum(GAME_PLATFORMS).optional(),
  listing: z.enum(LISTING_TYPES).optional(),
  freebie: z.coerce.boolean().optional(),
  sort: z.enum(MARKET_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
});

export type MarketQuery = z.infer<typeof marketQuerySchema>;

export function parseMarketQuery(
  input: Record<string, string | string[] | undefined>,
): MarketQuery {
  const scalar = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const parsed = marketQuerySchema.safeParse({
    q: scalar(input.q) || undefined,
    game: scalar(input.game) || undefined,
    category: scalar(input.category) || undefined,
    rarity: scalar(input.rarity) || undefined,
    platform: scalar(input.platform) || undefined,
    listing: scalar(input.listing) || undefined,
    freebie: scalar(input.freebie) || undefined,
    sort: scalar(input.sort) || "newest",
    page: scalar(input.page) || 1,
    pageSize: scalar(input.pageSize) || PAGE_SIZE,
  });

  if (!parsed.success) {
    return marketQuerySchema.parse({ sort: "newest", page: 1, pageSize: PAGE_SIZE });
  }

  return parsed.data;
}
