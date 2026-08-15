/**
 * Feed Engine ranking (ROADMAP.md Phase 8). A pure scoring function over a
 * bounded candidate window — see post.service.ts's listFeed for how the
 * candidate window is queried and how these scores turn into pages.
 *
 * Signal weights below are honest about what actually has real data behind
 * it today vs. what ROADMAP.md named as a Phase 8 input but hasn't been
 * built yet:
 *
 * REAL, wired signals:
 * - recency (post age, exponential decay)
 * - engagement (reactions/comments/saves — live counts, no denormalized
 *   counters exist yet, see post.service.ts)
 * - "following" (Phase 6, UserFollow) — a boost, not a hard filter like
 *   the pre-Phase-8 implementation used; a signed-in viewer now sees the
 *   whole public feed, ranked, with followed authors pushed up rather
 *   than everyone else being invisible
 * - group membership (Phase 5, GroupMember) — a post in a group you're in
 *   ranks higher than the same post would to a non-member
 * - shop relevance (Phase 3/4, ShopFollow + PostTag) — a post tagging a
 *   shop you follow ranks higher
 * - Boost (Phase 15) — a post in a currently-Boosted group gets the
 *   Boost's literal 3x exposure multiplier, per its "or any supported
 *   feature" design
 *
 * STUBBED at weight 0, not fabricated — turning one on later is a config
 * change here, not new plumbing, once the underlying data exists:
 * - user interests (ROADMAP.md Phase 1 names this as a Phase 8 input, but
 *   no interest-capture at registration or Interest/Tag-on-User model
 *   exists anywhere in this codebase yet — see ROADMAP.md Phase 8 status)
 * - ad targeting (Phase 7 KOBAads — no Ad/AdCampaign model exists yet,
 *   see ROADMAP.md Phase 15)
 * - influencer promo activity (Phase 10 — ROADMAP.md already calls this a
 *   soft dependency, stubbable until Phase 10 ships)
 * - cosmetic engagement (Phase 3 — no instrumentation tracks this
 *   anywhere; would need its own event log before it could be a signal)
 */
export const FEED_RANKING_WEIGHTS = {
  /** Half-life of the recency decay, in hours. A post at exactly this age
   * scores 0.5 on the recency axis before any other signal is applied. */
  recencyHalfLifeHours: 30,
  /** Log-scaled engagement contributes at most roughly this much on top
   * of the base recency score for a very heavily engaged post. */
  engagement: 0.6,
  reactionWeight: 1,
  commentWeight: 2,
  saveWeight: 3,
  following: 0.5,
  groupMember: 0.35,
  shopRelevance: 0.25,
  // Deliberately present at 0, not omitted — see doc comment above.
  interestMatch: 0,
  adTargeting: 0,
  influencerPromo: 0,
  cosmeticEngagement: 0,
} as const;

export function assertFeedRankingWeightsAreSane(): void {
  const w = FEED_RANKING_WEIGHTS;
  if (w.recencyHalfLifeHours <= 0) {
    throw new RangeError("recencyHalfLifeHours must be positive.");
  }
  for (const [key, value] of Object.entries(w)) {
    if (key === "recencyHalfLifeHours") continue;
    if (value < 0) {
      throw new RangeError(`Feed ranking weight "${key}" must be non-negative.`);
    }
  }
}

/** Exponential decay: 1.0 at age 0, 0.5 at exactly the configured
 * half-life, asymptotically approaching 0 for very old posts. */
export function recencyScore(ageMs: number, halfLifeHours: number = FEED_RANKING_WEIGHTS.recencyHalfLifeHours): number {
  const ageHours = Math.max(0, ageMs) / (60 * 60 * 1000);
  return Math.pow(0.5, ageHours / halfLifeHours);
}

/** log1p-scaled so a handful of reactions doesn't already saturate the
 * signal, but returns are diminishing rather than unbounded. */
export function engagementScore(input: { reactions: number; comments: number; saves: number }): number {
  const w = FEED_RANKING_WEIGHTS;
  const weighted =
    Math.max(0, input.reactions) * w.reactionWeight +
    Math.max(0, input.comments) * w.commentWeight +
    Math.max(0, input.saves) * w.saveWeight;
  return Math.log1p(weighted);
}

export type PostScoreInput = {
  ageMs: number;
  reactions: number;
  comments: number;
  saves: number;
  followedAuthor: boolean;
  viewerInGroup: boolean;
  shopRelevant: boolean;
  groupBoosted: boolean;
  boostMultiplier: number;
};

export function computePostScore(input: PostScoreInput): number {
  const w = FEED_RANKING_WEIGHTS;
  const recency = recencyScore(input.ageMs);
  const engagement = engagementScore(input) * w.engagement;
  const boosts =
    (input.followedAuthor ? w.following : 0) +
    (input.viewerInGroup ? w.groupMember : 0) +
    (input.shopRelevant ? w.shopRelevance : 0);
  const base = recency * (1 + engagement + boosts);
  return input.groupBoosted ? base * input.boostMultiplier : base;
}

export type FeedCursor = { score: number; id: string };

/** Opaque to callers — base64 JSON, not meant to be human-editable, just
 * URL-safe and cheap to round-trip. */
export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeFeedCursor(raw: string | null | undefined): FeedCursor | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "score" in parsed &&
      "id" in parsed &&
      typeof (parsed as { score: unknown }).score === "number" &&
      typeof (parsed as { id: unknown }).id === "string"
    ) {
      return parsed as FeedCursor;
    }
    return null;
  } catch {
    return null;
  }
}

/** Stable ranked-list comparator: score desc, id desc as a deterministic
 * tiebreak (matters for cursor pagination — ties must resolve the same
 * way on every request). */
export function compareRanked(a: FeedCursor, b: FeedCursor): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** True if `item` sorts strictly after `cursor` in ranked order — i.e. it
 * belongs on the next page. */
export function isAfterCursor(item: FeedCursor, cursor: FeedCursor): boolean {
  return compareRanked(item, cursor) > 0;
}
