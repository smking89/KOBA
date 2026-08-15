import type { Prisma } from "@/lib/generated/prisma/client";
import type { CosmeticQuery } from "@/features/marketplace/schemas/cosmetic.schemas";

export function buildPublicCosmeticWhere(query: CosmeticQuery): Prisma.CosmeticWhereInput {
  const where: Prisma.CosmeticWhereInput = {
    moderationStatus: "APPROVED",
  };

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
    ];
  }

  if (query.subType) {
    where.subType = query.subType;
  }

  if (query.rarity) {
    where.rarity = query.rarity;
  }

  return where;
}

export function buildCosmeticOrderBy(): Prisma.CosmeticOrderByWithRelationInput {
  return { createdAt: "desc" };
}
