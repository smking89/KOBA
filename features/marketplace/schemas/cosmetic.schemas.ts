import { z } from "zod";
import {
  COSMETIC_SUB_TYPES,
  MAX_PAGE_SIZE,
  PAGE_SIZE,
  PRODUCT_RARITIES,
} from "@/features/marketplace/lib/catalog";

export const upsertCosmeticSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(8).max(4000),
  subType: z.enum(COSMETIC_SUB_TYPES),
  rarity: z.enum(PRODUCT_RARITIES),
  priceCents: z.number().int().min(0).max(10_000_000),
  currency: z.string().trim().length(3).default("USD"),
});

export type UpsertCosmeticInput = z.infer<typeof upsertCosmeticSchema>;

export const cosmeticQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  subType: z.enum(COSMETIC_SUB_TYPES).optional(),
  rarity: z.enum(PRODUCT_RARITIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
});

export type CosmeticQuery = z.infer<typeof cosmeticQuerySchema>;

export function parseCosmeticQuery(
  input: Record<string, string | string[] | undefined>,
): CosmeticQuery {
  const scalar = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const parsed = cosmeticQuerySchema.safeParse({
    q: scalar(input.q) || undefined,
    subType: scalar(input.subType) || undefined,
    rarity: scalar(input.rarity) || undefined,
    page: scalar(input.page) || 1,
    pageSize: scalar(input.pageSize) || PAGE_SIZE,
  });

  if (!parsed.success) {
    return cosmeticQuerySchema.parse({ page: 1, pageSize: PAGE_SIZE });
  }

  return parsed.data;
}
