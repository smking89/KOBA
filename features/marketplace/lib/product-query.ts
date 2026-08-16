import type { Prisma } from "@/lib/generated/prisma/client";
import type { MarketQuery } from "@/features/marketplace/schemas/market.schemas";
import type { MarketSort } from "@/features/marketplace/lib/catalog";

export function buildPublicProductWhere(query: MarketQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    moderationStatus: "APPROVED",
    publishedAt: { not: null },
  };

  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
    ];
  }

  if (query.game) {
    where.game = { slug: query.game };
  }

  if (query.category) {
    where.category = { slug: query.category };
  }

  if (query.rarity) {
    where.rarity = query.rarity;
  }

  if (query.platform) {
    where.platforms = { has: query.platform };
  }

  if (query.listing) {
    where.listingType = query.listing;
  }

  if (query.freebie) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { freebiePolicy: "PERMANENT" },
          // A limited-quantity freebie with nothing left shouldn't show as claimable.
          { freebiePolicy: "LIMITED_QUANTITY", freebieQuantityRemaining: { gt: 0 } },
        ],
      },
    ];
  }

  return where;
}

export function buildProductOrderBy(sort: MarketSort): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { priceCents: "asc" };
    case "price_desc":
      return { priceCents: "desc" };
    case "rarity":
      return { rarityRank: "desc" };
    default:
      return { publishedAt: "desc" };
  }
}
