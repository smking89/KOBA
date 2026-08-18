import { prisma } from "@/lib/db";

export type BlacklistUserCandidate = {
  userId: string;
  handle: string;
  displayName: string | null;
  matchedVia: "handle" | "kobaId" | "shop";
  kobaId: { code: string; accountType: string } | null;
  shopName: string | null;
};

export type BlacklistShopCandidate = {
  shopId: string;
  name: string;
  slug: string;
  ownerUserId: string;
};

function stripAt(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

/** Finds candidate people to blacklist — by @handle, KOBAID code, or a
 * shop name/slug (resolved to that shop's owner). Client, 2026-08-18:
 * "search the blacklist via @usename or @shopname". */
export async function searchBlacklistUserCandidates(
  rawQuery: string,
  limit = 8,
): Promise<BlacklistUserCandidate[]> {
  const query = stripAt(rawQuery);
  if (query.length < 2) return [];

  const [byHandle, byKobaId, byShop] = await Promise.all([
    prisma.accountProfile.findMany({
      where: { handle: { contains: query, mode: "insensitive" } },
      select: { userId: true, handle: true, displayName: true },
      take: limit,
    }),
    prisma.kobaIdentity.findMany({
      where: { code: { contains: query, mode: "insensitive" } },
      select: {
        code: true,
        accountType: true,
        userId: true,
        user: { select: { profile: { select: { handle: true, displayName: true } } } },
      },
      take: limit,
    }),
    prisma.shop.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        name: true,
        ownerUserId: true,
        owner: { select: { profile: { select: { handle: true, displayName: true } } } },
      },
      take: limit,
    }),
  ]);

  const byUserId = new Map<string, BlacklistUserCandidate>();

  for (const row of byHandle) {
    byUserId.set(row.userId, {
      userId: row.userId,
      handle: row.handle,
      displayName: row.displayName,
      matchedVia: "handle",
      kobaId: null,
      shopName: null,
    });
  }
  for (const row of byKobaId) {
    if (byUserId.has(row.userId)) continue;
    byUserId.set(row.userId, {
      userId: row.userId,
      handle: row.user.profile?.handle ?? row.userId,
      displayName: row.user.profile?.displayName ?? null,
      matchedVia: "kobaId",
      kobaId: { code: row.code, accountType: row.accountType },
      shopName: null,
    });
  }
  for (const row of byShop) {
    if (byUserId.has(row.ownerUserId)) continue;
    byUserId.set(row.ownerUserId, {
      userId: row.ownerUserId,
      handle: row.owner.profile?.handle ?? row.ownerUserId,
      displayName: row.owner.profile?.displayName ?? null,
      matchedVia: "shop",
      kobaId: null,
      shopName: row.name,
    });
  }

  return Array.from(byUserId.values()).slice(0, limit);
}

/** Superadmin-only: finds shops that could be blacklisted as an entity
 * (not just their owner). */
export async function searchBlacklistShopCandidates(
  rawQuery: string,
  limit = 8,
): Promise<BlacklistShopCandidate[]> {
  const query = stripAt(rawQuery);
  if (query.length < 2) return [];

  const shops = await prisma.shop.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, ownerUserId: true },
    take: limit,
  });

  return shops.map((shop) => ({
    shopId: shop.id,
    name: shop.name,
    slug: shop.slug,
    ownerUserId: shop.ownerUserId,
  }));
}
