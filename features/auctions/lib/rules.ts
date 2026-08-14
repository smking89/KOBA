export const DEFAULT_MIN_INCREMENT_CENTS = 1000;
export const DEFAULT_DURATION_HOURS = 48;
export const SNIPE_WINDOW_MS = 2 * 60 * 1000;
export const SNIPE_EXTEND_MS = 2 * 60 * 1000;
export const RESERVATION_MS = 48 * 60 * 60 * 1000;

export const AUCTION_STATUSES = ["SCHEDULED", "LIVE", "ENDED", "RESERVED", "CANCELLED"] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const BID_ERROR_CODES = [
  "NOT_FOUND",
  "NOT_LIVE",
  "ENDED",
  "SELF_BID",
  "TOO_LOW",
  "FORBIDDEN",
  "CONFLICT",
] as const;
export type BidErrorCode = (typeof BID_ERROR_CODES)[number];

export function nextMinimumBidCents(
  highBidCents: number | null,
  startingBidCents: number,
  minIncrementCents: number,
): number {
  if (highBidCents == null) {
    return startingBidCents;
  }
  return highBidCents + minIncrementCents;
}

export function canBidOnListing(input: {
  bidderUserId: string;
  sellerUserId: string;
  shopMemberUserIds: readonly string[];
}): boolean {
  return (
    input.bidderUserId !== input.sellerUserId &&
    !input.shopMemberUserIds.includes(input.bidderUserId)
  );
}

export function evaluateBid(input: {
  now: Date;
  status: AuctionStatus;
  startsAt: Date;
  endsAt: Date;
  amountCents: number;
  nextMinCents: number;
  bidderUserId: string;
  sellerUserId: string;
  shopMemberUserIds: readonly string[];
}): { ok: true } | { ok: false; code: BidErrorCode } {
  if (input.status === "ENDED" || input.status === "RESERVED" || input.status === "CANCELLED") {
    return { ok: false, code: "ENDED" };
  }
  if (input.status !== "LIVE" || input.now < input.startsAt) {
    return { ok: false, code: "NOT_LIVE" };
  }
  if (input.now >= input.endsAt) {
    return { ok: false, code: "ENDED" };
  }
  if (
    !canBidOnListing({
      bidderUserId: input.bidderUserId,
      sellerUserId: input.sellerUserId,
      shopMemberUserIds: input.shopMemberUserIds,
    })
  ) {
    return { ok: false, code: "SELF_BID" };
  }
  if (input.amountCents < input.nextMinCents) {
    return { ok: false, code: "TOO_LOW" };
  }
  return { ok: true };
}

export function extendedEndsAt(endsAt: Date, now: Date): Date {
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0 || remaining > SNIPE_WINDOW_MS) {
    return endsAt;
  }
  return new Date(now.getTime() + SNIPE_EXTEND_MS);
}

export function selectWinner(bids: readonly { amountCents: number; bidderUserId: string }[]): {
  winnerUserId: string;
  winningAmountCents: number;
} | null {
  if (bids.length === 0) {
    return null;
  }
  const highest = bids.reduce((lead, bid) => (bid.amountCents > lead.amountCents ? bid : lead));
  return { winnerUserId: highest.bidderUserId, winningAmountCents: highest.amountCents };
}

export function settleAuctionState(input: {
  now: Date;
  endsAt: Date;
  status: AuctionStatus;
  bids: readonly { amountCents: number; bidderUserId: string }[];
}):
  | { kind: "open" }
  | { kind: "ended" }
  | { kind: "reserved"; winnerUserId: string; winningAmountCents: number } {
  if (input.status === "ENDED" || input.status === "RESERVED" || input.status === "CANCELLED") {
    return input.status === "RESERVED" && input.bids.length > 0
      ? {
          kind: "reserved",
          winnerUserId: selectWinner(input.bids)!.winnerUserId,
          winningAmountCents: selectWinner(input.bids)!.winningAmountCents,
        }
      : { kind: "ended" };
  }
  if (input.now < input.endsAt) {
    return { kind: "open" };
  }
  const winner = selectWinner(input.bids);
  if (!winner) {
    return { kind: "ended" };
  }
  return { kind: "reserved", ...winner };
}

export type BidLedgerState = {
  highBidCents: number | null;
  highBidderId: string | null;
  endsAt: Date;
  bids: { bidderUserId: string; amountCents: number }[];
};

/** Sequential model of the bid transaction used to test competing bids. */
export function applyBidToLedger(
  state: BidLedgerState,
  bid: {
    now: Date;
    amountCents: number;
    bidderUserId: string;
    sellerUserId: string;
    shopMemberUserIds: readonly string[];
    startingBidCents: number;
    minIncrementCents: number;
    status: AuctionStatus;
    startsAt: Date;
  },
): { ok: true; state: BidLedgerState } | { ok: false; code: BidErrorCode } {
  const nextMin = nextMinimumBidCents(
    state.highBidCents,
    bid.startingBidCents,
    bid.minIncrementCents,
  );
  const verdict = evaluateBid({
    now: bid.now,
    status: bid.status,
    startsAt: bid.startsAt,
    endsAt: state.endsAt,
    amountCents: bid.amountCents,
    nextMinCents: nextMin,
    bidderUserId: bid.bidderUserId,
    sellerUserId: bid.sellerUserId,
    shopMemberUserIds: bid.shopMemberUserIds,
  });
  if (!verdict.ok) {
    return verdict;
  }
  return {
    ok: true,
    state: {
      highBidCents: bid.amountCents,
      highBidderId: bid.bidderUserId,
      endsAt: extendedEndsAt(state.endsAt, bid.now),
      bids: [...state.bids, { bidderUserId: bid.bidderUserId, amountCents: bid.amountCents }],
    },
  };
}
