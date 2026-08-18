import { prisma } from "@/lib/db";
import { buildCosmeticOrderBy, buildPublicCosmeticWhere } from "@/features/marketplace/lib/cosmetic-query";
import type { CosmeticQuery } from "@/features/marketplace/schemas/cosmetic.schemas";

/** The KOBA Shop is the only real browse surface for Cosmetics
 * (features/marketplace/services/cosmetic.service.ts has the API routes
 * but nothing consumed them — no cosmetics browse page existed before
 * this phase). Cosmetic-only, and scoped to shops with an APPROVED
 * KobaShopApplication — this is the second, narrower gate on top of
 * Cosmetic's own moderationStatus check. */
const kobaShopInclude = {
  ownerShop: { select: { id: true, slug: true, name: true, ownerUserId: true } },
} satisfies Record<string, unknown>;

export async function listKobaShopCosmetics(query: CosmeticQuery) {
  const where = {
    ...buildPublicCosmeticWhere(query),
    ownerShop: { kobaShopApplication: { status: "APPROVED" as const } },
  };
  const skip = (query.page - 1) * query.pageSize;

  const [total, rows] = await Promise.all([
    prisma.cosmetic.count({ where }),
    prisma.cosmetic.findMany({
      where,
      include: kobaShopInclude,
      orderBy: buildCosmeticOrderBy(),
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getKobaShopCosmetic(slug: string) {
  return prisma.cosmetic.findFirst({
    where: {
      slug,
      moderationStatus: "APPROVED",
      ownerShop: { kobaShopApplication: { status: "APPROVED" } },
    },
    include: kobaShopInclude,
  });
}

/** A handful of items for the homepage hero — newest first, per the
 * confirmed "always shown to everyone" decision (no session-state
 * personalization needed). */
export async function listKobaShopHeroCosmetics(limit = 6) {
  return prisma.cosmetic.findMany({
    where: { moderationStatus: "APPROVED", ownerShop: { kobaShopApplication: { status: "APPROVED" } } },
    include: kobaShopInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
