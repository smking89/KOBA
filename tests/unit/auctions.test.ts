import { describe, expect, it } from "vitest";
import {
  applyBidToLedger,
  canBidOnListing,
  evaluateBid,
  extendedEndsAt,
  nextMinimumBidCents,
  selectWinner,
  settleAuctionState,
  SNIPE_EXTEND_MS,
  SNIPE_WINDOW_MS,
} from "@/features/auctions/lib/rules";

const now = new Date("2026-08-14T12:00:00.000Z");
const endsAt = new Date("2026-08-14T14:00:00.000Z");
const startsAt = new Date("2026-08-14T10:00:00.000Z");

describe("auction bid math", () => {
  it("uses the starting price until a bid lands, then adds the increment", () => {
    expect(nextMinimumBidCents(null, 4600, 1000)).toBe(4600);
    expect(nextMinimumBidCents(4600, 4600, 1000)).toBe(5600);
  });

  it("blocks the seller and shop members from bidding", () => {
    expect(
      canBidOnListing({
        bidderUserId: "owner",
        sellerUserId: "owner",
        shopMemberUserIds: ["owner"],
      }),
    ).toBe(false);
    expect(
      canBidOnListing({
        bidderUserId: "mod",
        sellerUserId: "owner",
        shopMemberUserIds: ["owner", "mod"],
      }),
    ).toBe(false);
    expect(
      canBidOnListing({
        bidderUserId: "player",
        sellerUserId: "owner",
        shopMemberUserIds: ["owner"],
      }),
    ).toBe(true);
  });
});

describe("competing bids", () => {
  const base = {
    now,
    startsAt,
    sellerUserId: "seller",
    shopMemberUserIds: ["seller"] as const,
    startingBidCents: 31800,
    minIncrementCents: 1000,
    status: "LIVE" as const,
  };

  it("accepts the first valid bid and rejects a stale competing amount", () => {
    let state = {
      highBidCents: null as number | null,
      highBidderId: null as string | null,
      endsAt,
      bids: [] as { bidderUserId: string; amountCents: number }[],
    };

    const first = applyBidToLedger(state, {
      ...base,
      amountCents: 31800,
      bidderUserId: "theironwright",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    state = first.state;

    const stale = applyBidToLedger(state, {
      ...base,
      amountCents: 31800,
      bidderUserId: "maxbuilds",
    });
    expect(stale).toEqual({ ok: false, code: "TOO_LOW" });

    const second = applyBidToLedger(state, {
      ...base,
      amountCents: 32800,
      bidderUserId: "maxbuilds",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.state.highBidderId).toBe("maxbuilds");
    expect(second.state.highBidCents).toBe(32800);
    expect(second.state.bids).toHaveLength(2);
  });

  it("rejects self-bids even when the amount is high enough", () => {
    const verdict = evaluateBid({
      now,
      status: "LIVE",
      startsAt,
      endsAt,
      amountCents: 50000,
      nextMinCents: 31800,
      bidderUserId: "seller",
      sellerUserId: "seller",
      shopMemberUserIds: ["seller"],
    });
    expect(verdict).toEqual({ ok: false, code: "SELF_BID" });
  });

  it("extends the clock when a bid lands inside the anti-snipe window", () => {
    const almostOver = new Date(now.getTime() + SNIPE_WINDOW_MS - 1000);
    const extended = extendedEndsAt(almostOver, now);
    expect(extended.getTime() - now.getTime()).toBe(SNIPE_EXTEND_MS);
  });
});

describe("winner selection and reservation", () => {
  it("reserves the highest bidder after expiry", () => {
    const result = settleAuctionState({
      now: new Date(endsAt.getTime() + 1000),
      endsAt,
      status: "LIVE",
      bids: [
        { amountCents: 30500, bidderUserId: "maxbuilds" },
        { amountCents: 31800, bidderUserId: "theironwright" },
      ],
    });
    expect(result).toEqual({
      kind: "reserved",
      winnerUserId: "theironwright",
      winningAmountCents: 31800,
    });
  });

  it("ends with no winner when nobody bid", () => {
    expect(
      settleAuctionState({
        now: new Date(endsAt.getTime() + 1000),
        endsAt,
        status: "LIVE",
        bids: [],
      }),
    ).toEqual({ kind: "ended" });
  });

  it("keeps the auction open before the clock hits zero", () => {
    expect(
      settleAuctionState({
        now,
        endsAt,
        status: "LIVE",
        bids: [{ amountCents: 31800, bidderUserId: "maxbuilds" }],
      }),
    ).toEqual({ kind: "open" });
  });

  it("picks the highest amount", () => {
    expect(
      selectWinner([
        { amountCents: 29000, bidderUserId: "a" },
        { amountCents: 31800, bidderUserId: "b" },
        { amountCents: 30500, bidderUserId: "c" },
      ]),
    ).toEqual({ winnerUserId: "b", winningAmountCents: 31800 });
  });
});
