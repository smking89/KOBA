import { Prisma } from "@/lib/generated/prisma/client";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { publishAuction } from "@/features/auctions/lib/events";
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_MIN_INCREMENT_CENTS,
  RESERVATION_MS,
  evaluateBid,
  extendedEndsAt,
  nextMinimumBidCents,
  selectWinner,
  type BidErrorCode,
} from "@/features/auctions/lib/rules";

export class AuctionError extends Error {
  constructor(
    message: string,
    readonly code: BidErrorCode,
  ) {
    super(message);
    this.name = "AuctionError";
  }
}

export type PublicAuctionBid = {
  amountCents: number;
  bidder: string;
  createdAt: string;
  isYou: boolean;
};

export type PublicAuction = {
  status: string;
  startingBidCents: number;
  minIncrementCents: number;
  highBidCents: number | null;
  nextMinCents: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  reservedUntil: string | null;
  youAreWinning: boolean;
  isSeller: boolean;
  winnerDisplay: string | null;
  bids: PublicAuctionBid[];
};

function displayName(user: {
  name: string | null;
  profile: { displayName: string | null } | null;
}): string {
  return user.profile?.displayName ?? user.name ?? "Bidder";
}

export async function syncAuctionForProduct(
  productId: string,
  input?: { durationHours?: number; minIncrementCents?: number },
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { auction: true },
  });
  if (!product || product.listingType !== "AUCTION") {
    return null;
  }

  const now = new Date();
  const durationHours = input?.durationHours ?? DEFAULT_DURATION_HOURS;
  const minIncrementCents = input?.minIncrementCents ?? DEFAULT_MIN_INCREMENT_CENTS;
  const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  const live =
    product.moderationStatus === "APPROVED" && product.publishedAt != null && endsAt > now;

  if (!product.auction) {
    return prisma.auction.create({
      data: {
        productId: product.id,
        startingBidCents: product.priceCents,
        minIncrementCents,
        startsAt: now,
        endsAt,
        status: live ? "LIVE" : "SCHEDULED",
      },
    });
  }

  if (product.auction.bidCount > 0) {
    return product.auction;
  }

  return prisma.auction.update({
    where: { id: product.auction.id },
    data: {
      startingBidCents: product.priceCents,
      minIncrementCents,
      endsAt,
      status: live
        ? "LIVE"
        : product.auction.status === "CANCELLED"
          ? "SCHEDULED"
          : product.auction.status,
    },
  });
}

export async function activateAuctionForProduct(productId: string) {
  const auction = await prisma.auction.findUnique({ where: { productId } });
  if (!auction) {
    return syncAuctionForProduct(productId);
  }
  if (
    auction.status === "ENDED" ||
    auction.status === "RESERVED" ||
    auction.status === "CANCELLED"
  ) {
    return auction;
  }
  const now = new Date();
  if (auction.endsAt <= now) {
    return settleAuction(auction.id);
  }
  return prisma.auction.update({
    where: { id: auction.id },
    data: { status: "LIVE", startsAt: auction.startsAt > now ? now : auction.startsAt },
  });
}

async function emitAuction(
  productSlug: string,
  auction: { highBidCents: number | null; bidCount: number; endsAt: Date; status: string },
) {
  publishAuction({
    slug: productSlug,
    highBidCents: auction.highBidCents,
    bidCount: auction.bidCount,
    endsAt: auction.endsAt.toISOString(),
    status: auction.status,
  });
}

export async function settleAuction(auctionId: string) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${auctionId} FOR UPDATE`;
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      include: {
        product: { select: { slug: true } },
        bids: {
          where: { status: { in: ["ACTIVE", "OUTBID", "WON"] } },
          orderBy: { amountCents: "desc" },
        },
      },
    });
    if (!auction) {
      return null;
    }
    if (
      auction.status === "ENDED" ||
      auction.status === "RESERVED" ||
      auction.status === "CANCELLED"
    ) {
      return auction;
    }
    const now = new Date();
    if (now < auction.endsAt) {
      return auction;
    }

    const winner = selectWinner(
      auction.bids.map((bid) => ({ amountCents: bid.amountCents, bidderUserId: bid.bidderUserId })),
    );

    if (!winner) {
      const ended = await tx.auction.update({
        where: { id: auction.id },
        data: { status: "ENDED", winnerUserId: null, reservedUntil: null },
      });
      return { ...ended, product: auction.product };
    }

    await tx.bid.updateMany({
      where: {
        auctionId: auction.id,
        bidderUserId: winner.winnerUserId,
        amountCents: winner.winningAmountCents,
      },
      data: { status: "WON" },
    });

    const reserved = await tx.auction.update({
      where: { id: auction.id },
      data: {
        status: "RESERVED",
        winnerUserId: winner.winnerUserId,
        highBidCents: winner.winningAmountCents,
        reservedUntil: new Date(now.getTime() + RESERVATION_MS),
      },
    });

    await writeAuditLog({
      actorUserId: null,
      action: AuditAction.AUCTION_SETTLED,
      targetType: "Auction",
      targetId: auction.id,
      metadata: { slug: auction.product.slug, winnerUserId: winner.winnerUserId },
    });

    return { ...reserved, product: auction.product };
  });

  if (result && "product" in result && result.product) {
    await emitAuction(result.product.slug, result);
  }
  return result;
}

export async function settleExpiredAuctions(productIds?: string[]) {
  const expired = await prisma.auction.findMany({
    where: {
      status: { in: ["LIVE", "SCHEDULED"] },
      endsAt: { lte: new Date() },
      ...(productIds ? { productId: { in: productIds } } : {}),
    },
    select: { id: true },
    take: 25,
  });
  for (const row of expired) {
    await settleAuction(row.id);
  }
}

export async function getPublicAuction(
  productSlug: string,
  viewerUserId?: string | null,
): Promise<PublicAuction | null> {
  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    select: { id: true, listingType: true },
  });
  if (!product || product.listingType !== "AUCTION") {
    return null;
  }

  await settleExpiredAuctions([product.id]);

  const auction = await prisma.auction.findUnique({
    where: { productId: product.id },
    include: {
      product: {
        select: {
          sellerUserId: true,
          shop: { select: { members: { select: { userId: true } } } },
        },
      },
      winner: { select: { name: true, profile: { select: { displayName: true } } } },
      bids: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { bidder: { select: { name: true, profile: { select: { displayName: true } } } } },
      },
    },
  });

  if (!auction) {
    return null;
  }

  const shopMemberUserIds = auction.product.shop?.members.map((row) => row.userId) ?? [];
  const isSeller = Boolean(
    viewerUserId &&
    (viewerUserId === auction.product.sellerUserId || shopMemberUserIds.includes(viewerUserId)),
  );

  return {
    status: auction.status,
    startingBidCents: auction.startingBidCents,
    minIncrementCents: auction.minIncrementCents,
    highBidCents: auction.highBidCents,
    nextMinCents: nextMinimumBidCents(
      auction.highBidCents,
      auction.startingBidCents,
      auction.minIncrementCents,
    ),
    bidCount: auction.bidCount,
    startsAt: auction.startsAt.toISOString(),
    endsAt: auction.endsAt.toISOString(),
    reservedUntil: auction.reservedUntil?.toISOString() ?? null,
    youAreWinning: Boolean(
      viewerUserId &&
      auction.bids.some(
        (bid) =>
          bid.bidderUserId === viewerUserId && (bid.status === "ACTIVE" || bid.status === "WON"),
      ),
    ),
    isSeller,
    winnerDisplay: auction.winner ? displayName(auction.winner) : null,
    bids: auction.bids.map((bid) => ({
      amountCents: bid.amountCents,
      bidder: displayName(bid.bidder),
      createdAt: bid.createdAt.toISOString(),
      isYou: viewerUserId === bid.bidderUserId,
    })),
  };
}

export async function countActiveBids(userId: string): Promise<number> {
  return prisma.bid.count({
    where: {
      bidderUserId: userId,
      status: "ACTIVE",
      auction: { status: "LIVE" },
    },
  });
}

export async function placeBid(
  userId: string,
  productSlug: string,
  input: { amountCents: number; idempotencyKey: string },
  ipAddress?: string | null,
) {
  const existing = await prisma.bid.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { auction: { include: { product: { select: { slug: true } } } } },
  });
  if (existing) {
    if (existing.bidderUserId !== userId) {
      throw new AuctionError("Idempotency key already used.", "CONFLICT");
    }
    if (existing.amountCents !== input.amountCents) {
      throw new AuctionError("Idempotency key reused with a different amount.", "CONFLICT");
    }
    return getPublicAuction(productSlug, userId);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          const product = await tx.product.findUnique({
            where: { slug: productSlug },
            include: {
              auction: true,
              shop: { include: { members: { select: { userId: true } } } },
            },
          });
          if (!product?.auction) {
            throw new AuctionError("Auction not found.", "NOT_FOUND");
          }
          if (product.moderationStatus !== "APPROVED" || product.publishedAt == null) {
            throw new AuctionError("This listing is not live.", "NOT_LIVE");
          }

          await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${product.auction.id} FOR UPDATE`;
          const locked = await tx.auction.findUniqueOrThrow({ where: { id: product.auction.id } });

          const now = new Date();
          if (now >= locked.endsAt || locked.status === "ENDED" || locked.status === "RESERVED") {
            throw new AuctionError("This auction has ended.", "ENDED");
          }

          const shopMemberUserIds = product.shop?.members.map((row) => row.userId) ?? [];
          const nextMin = nextMinimumBidCents(
            locked.highBidCents,
            locked.startingBidCents,
            locked.minIncrementCents,
          );
          const verdict = evaluateBid({
            now,
            status: locked.status,
            startsAt: locked.startsAt,
            endsAt: locked.endsAt,
            amountCents: input.amountCents,
            nextMinCents: nextMin,
            bidderUserId: userId,
            sellerUserId: product.sellerUserId,
            shopMemberUserIds,
          });
          if (!verdict.ok) {
            const messages: Record<BidErrorCode, string> = {
              NOT_FOUND: "Auction not found.",
              NOT_LIVE: "This auction is not accepting bids.",
              ENDED: "This auction has ended.",
              SELF_BID: "You cannot bid on your own listing.",
              TOO_LOW: `Bid at least ${nextMin} cents.`,
              FORBIDDEN: "You cannot bid on this auction.",
              CONFLICT: "Bid conflict.",
            };
            throw new AuctionError(messages[verdict.code], verdict.code);
          }

          if (locked.highBidCents != null) {
            await tx.bid.updateMany({
              where: { auctionId: locked.id, status: "ACTIVE" },
              data: { status: "OUTBID" },
            });
          }

          await tx.bid.create({
            data: {
              auctionId: locked.id,
              bidderUserId: userId,
              amountCents: input.amountCents,
              status: "ACTIVE",
              idempotencyKey: input.idempotencyKey,
            },
          });

          const endsAt = extendedEndsAt(locked.endsAt, now);
          const next = await tx.auction.update({
            where: { id: locked.id },
            data: {
              highBidCents: input.amountCents,
              bidCount: { increment: 1 },
              endsAt,
              status: "LIVE",
            },
          });

          return { slug: product.slug, auction: next, auctionId: locked.id };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
        },
      );
      await writeAuditLog({
        actorUserId: userId,
        action: AuditAction.BID_PLACED,
        targetType: "Auction",
        targetId: updated.auctionId,
        metadata: { slug: updated.slug, amountCents: input.amountCents },
        ipAddress: ipAddress ?? null,
      });
      await emitAuction(updated.slug, updated.auction);
      return getPublicAuction(productSlug, userId);
    } catch (error) {
      if (error instanceof AuctionError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return getPublicAuction(productSlug, userId);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2028") &&
        attempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new AuctionError("Bid conflict.", "CONFLICT");
}
