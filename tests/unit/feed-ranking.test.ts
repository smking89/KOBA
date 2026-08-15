import { describe, expect, it } from "vitest";
import {
  assertFeedRankingWeightsAreSane,
  compareRanked,
  computePostScore,
  decodeFeedCursor,
  encodeFeedCursor,
  engagementScore,
  isAfterCursor,
  recencyScore,
  type FeedCursor,
} from "@/features/social/lib/feed-ranking";

describe("feed ranking weights", () => {
  it("are internally sane (non-negative, positive half-life)", () => {
    expect(() => assertFeedRankingWeightsAreSane()).not.toThrow();
  });
});

describe("recencyScore", () => {
  it("is 1.0 at age zero", () => {
    expect(recencyScore(0, 30)).toBe(1);
  });

  it("is 0.5 at exactly the half-life", () => {
    const halfLifeMs = 30 * 60 * 60 * 1000;
    expect(recencyScore(halfLifeMs, 30)).toBeCloseTo(0.5, 5);
  });

  it("approaches zero for very old posts", () => {
    const veryOldMs = 365 * 24 * 60 * 60 * 1000;
    expect(recencyScore(veryOldMs, 30)).toBeLessThan(0.001);
  });

  it("clamps negative age to zero rather than boosting future posts", () => {
    expect(recencyScore(-1000, 30)).toBe(1);
  });
});

describe("engagementScore", () => {
  it("is zero for no engagement", () => {
    expect(engagementScore({ reactions: 0, comments: 0, saves: 0 })).toBe(0);
  });

  it("increases monotonically with more engagement", () => {
    const low = engagementScore({ reactions: 1, comments: 0, saves: 0 });
    const high = engagementScore({ reactions: 10, comments: 5, saves: 2 });
    expect(high).toBeGreaterThan(low);
  });

  it("weighs comments and saves more than raw reactions (per config)", () => {
    const reactionsOnly = engagementScore({ reactions: 10, comments: 0, saves: 0 });
    const commentsOnly = engagementScore({ reactions: 0, comments: 10, saves: 0 });
    expect(commentsOnly).toBeGreaterThan(reactionsOnly);
  });
});

describe("computePostScore", () => {
  const base = {
    ageMs: 0,
    reactions: 0,
    comments: 0,
    saves: 0,
    followedAuthor: false,
    viewerInGroup: false,
    shopRelevant: false,
    groupBoosted: false,
    boostMultiplier: 3,
  };

  it("ranks a fresh, followed-author post above an identical unfollowed one", () => {
    const followed = computePostScore({ ...base, followedAuthor: true });
    const notFollowed = computePostScore({ ...base, followedAuthor: false });
    expect(followed).toBeGreaterThan(notFollowed);
  });

  it("ranks a fresh, engaged post above an identical quiet one", () => {
    const engaged = computePostScore({ ...base, reactions: 20, comments: 10, saves: 5 });
    const quiet = computePostScore({ ...base });
    expect(engaged).toBeGreaterThan(quiet);
  });

  it("applies the Boost multiplier literally (3x) to a boosted group's post", () => {
    const boosted = computePostScore({ ...base, groupBoosted: true, boostMultiplier: 3 });
    const notBoosted = computePostScore({ ...base, groupBoosted: false });
    expect(boosted).toBeCloseTo(notBoosted * 3, 5);
  });

  it("never returns a negative score for a plausible input range", () => {
    const score = computePostScore({
      ...base,
      ageMs: 60 * 24 * 60 * 60 * 1000,
      reactions: 0,
      comments: 0,
      saves: 0,
    });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("feed cursor encode/decode", () => {
  const cursor: FeedCursor = { score: 1.2345, id: "post_abc123" };

  it("round-trips through encode/decode", () => {
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor);
  });

  it("returns null for garbage input", () => {
    expect(decodeFeedCursor("not-valid-base64-json!!!")).toBeNull();
    expect(decodeFeedCursor(undefined)).toBeNull();
    expect(decodeFeedCursor(null)).toBeNull();
  });

  it("returns null for well-formed base64 that isn't a cursor shape", () => {
    const notACursor = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(decodeFeedCursor(notACursor)).toBeNull();
  });
});

describe("compareRanked / isAfterCursor", () => {
  it("orders higher score first", () => {
    expect(compareRanked({ score: 5, id: "a" }, { score: 1, id: "b" })).toBeLessThan(0);
  });

  it("breaks ties by id descending, deterministically", () => {
    expect(compareRanked({ score: 1, id: "b" }, { score: 1, id: "a" })).toBeLessThan(0);
    expect(compareRanked({ score: 1, id: "a" }, { score: 1, id: "b" })).toBeGreaterThan(0);
  });

  it("isAfterCursor matches strict post-cursor ordering", () => {
    const cursor: FeedCursor = { score: 5, id: "m" };
    expect(isAfterCursor({ score: 4, id: "z" }, cursor)).toBe(true);
    expect(isAfterCursor({ score: 6, id: "z" }, cursor)).toBe(false);
    expect(isAfterCursor({ score: 5, id: "m" }, cursor)).toBe(false);
    expect(isAfterCursor({ score: 5, id: "a" }, cursor)).toBe(true);
  });
});
