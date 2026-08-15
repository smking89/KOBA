import { prisma } from "@/lib/db";
import {
  buildCosmeticOrderBy,
  buildPublicCosmeticWhere,
} from "@/features/marketplace/lib/cosmetic-query";
import type { CosmeticQuery } from "@/features/marketplace/schemas/cosmetic.schemas";
import type { PublicCosmetic } from "@/features/marketplace/lib/cosmetic-dto";
import type { CosmeticSubType, ProductRarity } from "@/features/marketplace/lib/catalog";

const cosmeticInclude = {
  ownerShop: { select: { slug: true, name: true } },
} satisfies Record<string, unknown>;

type CosmeticRecord = Awaited<
  ReturnType<typeof prisma.cosmetic.findFirst<{ include: typeof cosmeticInclude }>>
>;

function toDto(cosmetic: NonNullable<CosmeticRecord>): PublicCosmetic {
  return {
    slug: cosmetic.slug,
    name: cosmetic.name,
    description: cosmetic.description,
    subType: cosmetic.subType as CosmeticSubType,
    rarity: cosmetic.rarity as ProductRarity,
    priceCents: cosmetic.priceCents,
    currency: cosmetic.currency,
    shop: cosmetic.ownerShop,
  };
}

export async function listPublicCosmetics(query: CosmeticQuery) {
  const where = buildPublicCosmeticWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, rows] = await Promise.all([
    prisma.cosmetic.count({ where }),
    prisma.cosmetic.findMany({
      where,
      include: cosmeticInclude,
      orderBy: buildCosmeticOrderBy(),
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getPublicCosmetic(slug: string): Promise<PublicCosmetic | null> {
  const cosmetic = await prisma.cosmetic.findFirst({
    where: { slug, moderationStatus: "APPROVED" },
    include: cosmeticInclude,
  });
  return cosmetic ? toDto(cosmetic) : null;
}
