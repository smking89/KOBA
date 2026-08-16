import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { SocialError } from "@/features/social/lib/errors";
import {
  generateCommentRef,
  generatePostRef,
  generateReportRef,
  generateStoryRef,
} from "@/features/social/lib/refs";
import {
  canModerateSocial,
  canTagGroup,
  canTagShop,
  canTagUser,
  canViewPost,
  extractHandleMentions,
  isHttpsUrl,
  isStoryActive,
  type TagTargetType,
} from "@/features/social/lib/rules";
import type { CreatePostInput } from "@/features/social/schemas/social.schemas";
import { PAGE_SIZE } from "@/features/social/schemas/social.schemas";
import {
  compareRanked,
  computePostScore,
  decodeFeedCursor,
  encodeFeedCursor,
  isAfterCursor,
  type FeedCursor,
} from "@/features/social/lib/feed-ranking";
import { getCachedRankedIds, setCachedRankedIds } from "@/features/social/lib/feed-cache";
import { activeBoostedTargetIds, BOOST_MULTIPLIER } from "@/features/boost/services/boost.service";

const authorSelect = {
  id: true,
  name: true,
  profile: { select: { handle: true, displayName: true, tagPrivacy: true } },
  kobaIdentities: { select: { code: true }, take: 1 },
} as const;

function displayName(user: {
  name: string | null;
  profile: { displayName: string | null; handle: string | null } | null;
}): string {
  return user.profile?.displayName ?? user.name ?? "Player";
}

async function uniqueRef(kind: "post" | "comment" | "story" | "report"): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef =
      kind === "post"
        ? generatePostRef()
        : kind === "comment"
          ? generateCommentRef()
          : kind === "story"
            ? generateStoryRef()
            : generateReportRef();
    const clash =
      kind === "post"
        ? await prisma.post.findUnique({ where: { publicRef } })
        : kind === "comment"
          ? await prisma.postComment.findUnique({ where: { publicRef } })
          : kind === "story"
            ? await prisma.story.findUnique({ where: { publicRef } })
            : await prisma.contentReport.findUnique({ where: { publicRef } });
    if (!clash) {
      return publicRef;
    }
  }
  throw new SocialError("Could not allocate a public reference.", "CONFLICT");
}

async function blockedSet(viewerUserId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerUserId: viewerUserId }, { blockedUserId: viewerUserId }] },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerUserId === viewerUserId ? row.blockedUserId : row.blockerUserId);
  }
  return ids;
}

async function resolveTags(
  actorUserId: string,
  body: string,
  explicit: { type: TagTargetType; slug: string }[],
) {
  const mentions = extractHandleMentions(body).map((slug) => ({ type: "USER" as const, slug }));
  const merged = [...explicit, ...mentions];
  const unique = new Map<string, { type: TagTargetType; slug: string }>();
  for (const tag of merged) {
    unique.set(`${tag.type}:${tag.slug.toLowerCase()}`, {
      type: tag.type,
      slug: tag.slug.toLowerCase(),
    });
  }
  const resolved: { type: TagTargetType; slug: string }[] = [];

  for (const tag of unique.values()) {
    if (tag.type === "USER") {
      const profile = await prisma.accountProfile.findUnique({ where: { handle: tag.slug } });
      if (!profile) {
        continue;
      }
      const [follows, block] = await Promise.all([
        prisma.userFollow.findUnique({
          where: {
            followerUserId_followingUserId: {
              followerUserId: actorUserId,
              followingUserId: profile.userId,
            },
          },
        }),
        prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerUserId: actorUserId, blockedUserId: profile.userId },
              { blockerUserId: profile.userId, blockedUserId: actorUserId },
            ],
          },
        }),
      ]);
      if (
        !canTagUser({
          privacy: profile.tagPrivacy,
          actorFollowsTarget: Boolean(follows),
          blocked: Boolean(block),
          isSelf: actorUserId === profile.userId,
        })
      ) {
        throw new SocialError(`@${tag.slug} does not allow this tag.`, "TAG_DENIED");
      }
      resolved.push({ type: "USER", slug: profile.handle });
    } else if (tag.type === "SHOP") {
      const shop = await prisma.shop.findUnique({ where: { slug: tag.slug } });
      if (!shop) {
        continue;
      }
      if (!canTagShop(shop.taggingAllowed)) {
        throw new SocialError("This shop does not allow tagging.", "TAG_DENIED");
      }
      resolved.push({ type: "SHOP", slug: shop.slug });
    } else if (tag.type === "GROUP") {
      const group = await prisma.group.findUnique({
        where: { slug: tag.slug },
        include: { members: { where: { userId: actorUserId } } },
      });
      if (!group) {
        continue;
      }
      if (
        !canTagGroup({
          taggingAllowed: group.taggingAllowed,
          isMember: group.members.length > 0,
          visibility: group.visibility,
        })
      ) {
        throw new SocialError("This group does not allow tagging.", "TAG_DENIED");
      }
      resolved.push({ type: "GROUP", slug: group.slug });
    } else {
      const product = await prisma.product.findUnique({ where: { slug: tag.slug } });
      if (!product || product.moderationStatus !== "APPROVED" || product.publishedAt == null) {
        continue;
      }
      resolved.push({ type: "PRODUCT", slug: product.slug });
    }
  }
  return resolved;
}

function toPostDto(
  post: {
    publicRef: string;
    body: string;
    visibility: "PUBLIC" | "FOLLOWERS";
    sponsored: boolean;
    createdAt: Date;
    author: {
      name: string | null;
      profile: { handle: string | null; displayName: string | null } | null;
      kobaIdentities: { code: string }[];
    };
    media: { url: string; kind: string }[];
    tags: { targetType: TagTargetType; targetSlug: string }[];
    _count: { reactions: number; comments: number };
    comments?: {
      publicRef: string;
      body: string;
      createdAt: Date;
      author: {
        name: string | null;
        profile: { handle: string | null; displayName: string | null } | null;
      };
    }[];
    group?: { slug: string; name: string } | null;
  },
  viewer: { liked: boolean; saved: boolean },
) {
  return {
    publicRef: post.publicRef,
    body: post.body,
    visibility: post.visibility,
    sponsored: post.sponsored,
    createdAt: post.createdAt.toISOString(),
    author: {
      handle: post.author.profile?.handle ?? "player",
      name: displayName(post.author),
      kobaId: post.author.kobaIdentities[0]?.code ?? null,
    },
    group: post.group ?? null,
    media: post.media.map((row) => ({ url: row.url, kind: row.kind })),
    tags: post.tags.map((row) => ({ type: row.targetType, slug: row.targetSlug })),
    likeCount: post._count.reactions,
    commentCount: post._count.comments,
    liked: viewer.liked,
    saved: viewer.saved,
    comments: (post.comments ?? []).map((comment) => ({
      publicRef: comment.publicRef,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: {
        handle: comment.author.profile?.handle ?? "player",
        name: displayName(comment.author),
      },
    })),
  };
}

export async function createPost(
  userId: string,
  input: CreatePostInput,
  ipAddress?: string | null,
) {
  if (input.mediaUrl && !isHttpsUrl(input.mediaUrl)) {
    throw new SocialError("Media URLs must use https.", "INVALID");
  }
  let groupId: string | null = null;
  if (input.groupSlug) {
    const group = await prisma.group.findUnique({
      where: { slug: input.groupSlug },
      include: { members: { where: { userId } } },
    });
    if (!group || group.members.length === 0) {
      throw new SocialError("Join the group before posting there.", "FORBIDDEN");
    }
    groupId = group.id;
  }
  const tags = await resolveTags(userId, input.body, input.tags ?? []);
  const publicRef = await uniqueRef("post");
  const post = await prisma.post.create({
    data: {
      publicRef,
      authorUserId: userId,
      groupId,
      body: input.body,
      visibility: input.visibility,
      tags: {
        create: tags.map((tag) => ({ targetType: tag.type, targetSlug: tag.slug })),
      },
      ...(input.mediaUrl
        ? { media: { create: { url: input.mediaUrl, kind: "IMAGE" as const } } }
        : {}),
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.POST_CREATED,
    targetType: "Post",
    targetId: post.id,
    metadata: { publicRef },
    ipAddress: ipAddress ?? null,
  });
  return { publicRef };
}

/** Candidate window for ranking — bounded so scoring stays cheap. A post
 * older than this never surfaces in the ranked feed regardless of
 * engagement. Real correct ranking within this window; ranking across a
 * much larger/older corpus would need a materialized score column or a
 * search index (ROADMAP.md open question #9), not a bigger constant here. */
const CANDIDATE_WINDOW_DAYS = 30;
const CANDIDATE_POOL_SIZE = 300;

export async function listFeed(input: {
  viewerUserId?: string | undefined;
  cursor?: string | undefined;
  pageSize?: number | undefined;
  groupSlug?: string | undefined;
}) {
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const cursor = decodeFeedCursor(input.cursor);
  const blocked = input.viewerUserId ? await blockedSet(input.viewerUserId) : new Set<string>();
  const following = input.viewerUserId
    ? await prisma.userFollow.findMany({
        where: { followerUserId: input.viewerUserId },
        select: { followingUserId: true },
      })
    : [];
  const followingIds = new Set(following.map((row) => row.followingUserId));
  if (input.viewerUserId) {
    followingIds.add(input.viewerUserId);
  }

  let groupId: string | undefined;
  if (input.groupSlug) {
    const group = await prisma.group.findUnique({
      where: { slug: input.groupSlug },
      include: { members: input.viewerUserId ? { where: { userId: input.viewerUserId } } : false },
    });
    if (!group) {
      throw new SocialError("Group not found.", "NOT_FOUND");
    }
    const isMember = Array.isArray(group.members) && group.members.length > 0;
    if (group.visibility === "PRIVATE" && !isMember) {
      throw new SocialError("Group not found.", "NOT_FOUND");
    }
    groupId = group.id;
  }

  const [memberGroupIds, followedShopSlugs, boostedGroupIds] = await Promise.all([
    input.viewerUserId
      ? prisma.groupMember
          .findMany({ where: { userId: input.viewerUserId }, select: { groupId: true } })
          .then((rows) => new Set(rows.map((row) => row.groupId)))
      : Promise.resolve(new Set<string>()),
    input.viewerUserId
      ? prisma.shopFollow
          .findMany({
            where: { userId: input.viewerUserId },
            include: { shop: { select: { slug: true } } },
          })
          .then((rows) => new Set(rows.map((row) => row.shop.slug)))
      : Promise.resolve(new Set<string>()),
    activeBoostedTargetIds("GROUP"),
  ]);

  // Ranking order is cached briefly (post *content* is always fetched
  // fresh below, per viewer, so a cache hit can't serve stale/moderated
  // content — see feed-cache.ts).
  const cacheKey = `${input.viewerUserId ?? "anon"}:${groupId ?? "all"}`;
  let ranked: FeedCursor[] | null = await getCachedRankedIds(cacheKey);

  if (!ranked) {
    const windowStart = new Date(Date.now() - CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await prisma.post.findMany({
      where: {
        moderationStatus: "LIVE",
        createdAt: { gte: windowStart },
        ...(groupId
          ? { groupId }
          : input.viewerUserId
            ? { OR: [{ visibility: "PUBLIC" }, { authorUserId: { in: [...followingIds] } }] }
            : { visibility: "PUBLIC" }),
      },
      orderBy: { createdAt: "desc" },
      take: CANDIDATE_POOL_SIZE,
      select: {
        id: true,
        authorUserId: true,
        groupId: true,
        visibility: true,
        moderationStatus: true,
        createdAt: true,
        tags: { select: { targetType: true, targetSlug: true } },
        _count: { select: { reactions: true, comments: true, saves: true } },
      },
    });

    const now = Date.now();
    ranked = candidates
      .filter((post) => !blocked.has(post.authorUserId))
      .filter((post) =>
        canViewPost({
          visibility: post.visibility,
          moderationStatus: post.moderationStatus,
          isAuthor: post.authorUserId === input.viewerUserId,
          viewerFollowsAuthor: followingIds.has(post.authorUserId),
          blocked: false,
        }),
      )
      .map((post) => {
        const shopRelevant = post.tags.some(
          (tag) => tag.targetType === "SHOP" && followedShopSlugs.has(tag.targetSlug),
        );
        const score = computePostScore({
          ageMs: now - post.createdAt.getTime(),
          reactions: post._count.reactions,
          comments: post._count.comments,
          saves: post._count.saves,
          followedAuthor: followingIds.has(post.authorUserId),
          viewerInGroup: post.groupId ? memberGroupIds.has(post.groupId) : false,
          shopRelevant,
          groupBoosted: post.groupId ? boostedGroupIds.has(post.groupId) : false,
          boostMultiplier: BOOST_MULTIPLIER,
        });
        return { id: post.id, score };
      })
      .sort(compareRanked);

    await setCachedRankedIds(cacheKey, ranked);
  }

  const afterCursor = cursor ? ranked.filter((entry) => isAfterCursor(entry, cursor)) : ranked;
  const pageEntries = afterCursor.slice(0, pageSize + 1);
  const hasMore = pageEntries.length > pageSize;
  const pageIds = pageEntries.slice(0, pageSize).map((entry) => entry.id);

  const rows =
    pageIds.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: pageIds } },
          include: {
            author: { select: authorSelect },
            media: { orderBy: { sortOrder: "asc" } },
            tags: true,
            group: { select: { slug: true, name: true } },
            _count: { select: { reactions: true, comments: true } },
            comments: {
              where: { moderationStatus: "LIVE" },
              orderBy: { createdAt: "desc" },
              take: 2,
              include: { author: { select: authorSelect } },
            },
            reactions: input.viewerUserId ? { where: { userId: input.viewerUserId } } : false,
            saves: input.viewerUserId ? { where: { userId: input.viewerUserId } } : false,
          },
        })
      : [];

  const byId = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = pageIds.map((id) => byId.get(id)).filter((row) => row !== undefined);

  const lastEntry = pageEntries[pageIds.length - 1];
  const nextCursor = hasMore && lastEntry ? encodeFeedCursor(lastEntry) : null;

  return {
    items: orderedRows.map((post) =>
      toPostDto(post, {
        liked: Array.isArray(post.reactions) && post.reactions.length > 0,
        saved: Array.isArray(post.saves) && post.saves.length > 0,
      }),
    ),
    hasMore,
    nextCursor,
  };
}

export async function listProfilePosts(input: {
  handle: string;
  viewerUserId?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}) {
  const profile = await prisma.accountProfile.findUnique({
    where: { handle: input.handle.toLowerCase() },
  });
  if (!profile) {
    throw new SocialError("Profile not found.", "NOT_FOUND");
  }
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const blocked = input.viewerUserId
    ? await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerUserId: input.viewerUserId, blockedUserId: profile.userId },
            { blockerUserId: profile.userId, blockedUserId: input.viewerUserId },
          ],
        },
      })
    : null;
  if (blocked) {
    return { items: [], hasMore: false, nextCursor: null };
  }
  const viewerFollows =
    input.viewerUserId === profile.userId
      ? true
      : input.viewerUserId
        ? Boolean(
            await prisma.userFollow.findUnique({
              where: {
                followerUserId_followingUserId: {
                  followerUserId: input.viewerUserId,
                  followingUserId: profile.userId,
                },
              },
            }),
          )
        : false;

  const posts = await prisma.post.findMany({
    where: { authorUserId: profile.userId, moderationStatus: "LIVE" },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    include: {
      author: { select: authorSelect },
      media: { orderBy: { sortOrder: "asc" } },
      tags: true,
      group: { select: { slug: true, name: true } },
      _count: { select: { reactions: true, comments: true } },
      comments: {
        where: { moderationStatus: "LIVE" },
        orderBy: { createdAt: "desc" },
        take: 2,
        include: { author: { select: authorSelect } },
      },
      reactions: input.viewerUserId ? { where: { userId: input.viewerUserId } } : false,
      saves: input.viewerUserId ? { where: { userId: input.viewerUserId } } : false,
    },
  });

  const visible = posts.filter((post) =>
    canViewPost({
      visibility: post.visibility,
      moderationStatus: post.moderationStatus,
      isAuthor: post.authorUserId === input.viewerUserId,
      viewerFollowsAuthor: viewerFollows,
      blocked: false,
    }),
  );
  const pageItems = visible.slice(0, pageSize);
  return {
    items: pageItems.map((post) =>
      toPostDto(post, {
        liked: Array.isArray(post.reactions) && post.reactions.length > 0,
        saved: Array.isArray(post.saves) && post.saves.length > 0,
      }),
    ),
    hasMore: visible.length > pageSize,
    // NOTE: this is a page-number token, not a ranked-feed cursor — kept
    // as-is (pre-existing gap, not introduced by Phase 8): FeedList's
    // "more" handler posts this back to /api/social/feed, which is the
    // *global ranked feed* endpoint, not an author-scoped one, so
    // "load more" on a profile page was already not correctly paginating
    // this author's own posts before this change either. Fixing that
    // needs a dedicated author-scoped feed route, out of scope here.
    nextCursor: visible.length > pageSize ? String(page + 1) : null,
  };
}

export async function toggleReaction(userId: string, publicRef: string) {
  const post = await prisma.post.findUnique({ where: { publicRef } });
  if (!post || post.moderationStatus !== "LIVE") {
    throw new SocialError("Post not found.", "NOT_FOUND");
  }
  const existing = await prisma.postReaction.findUnique({
    where: { postId_userId: { postId: post.id, userId } },
  });
  if (existing) {
    await prisma.postReaction.delete({ where: { postId_userId: { postId: post.id, userId } } });
    return { liked: false };
  }
  await prisma.postReaction.create({ data: { postId: post.id, userId } });
  return { liked: true };
}

export async function toggleSave(userId: string, publicRef: string) {
  const post = await prisma.post.findUnique({ where: { publicRef } });
  if (!post || post.moderationStatus !== "LIVE") {
    throw new SocialError("Post not found.", "NOT_FOUND");
  }
  const existing = await prisma.postSave.findUnique({
    where: { postId_userId: { postId: post.id, userId } },
  });
  if (existing) {
    await prisma.postSave.delete({ where: { postId_userId: { postId: post.id, userId } } });
    return { saved: false };
  }
  await prisma.postSave.create({ data: { postId: post.id, userId } });
  return { saved: true };
}

export async function addComment(userId: string, publicRef: string, body: string) {
  const post = await prisma.post.findUnique({ where: { publicRef } });
  if (!post || post.moderationStatus !== "LIVE") {
    throw new SocialError("Post not found.", "NOT_FOUND");
  }
  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: userId, blockedUserId: post.authorUserId },
        { blockerUserId: post.authorUserId, blockedUserId: userId },
      ],
    },
  });
  if (blocked) {
    throw new SocialError("You cannot comment on this post.", "BLOCKED");
  }
  const commentRef = await uniqueRef("comment");
  await prisma.postComment.create({
    data: { publicRef: commentRef, postId: post.id, authorUserId: userId, body },
  });
  return { publicRef: commentRef };
}

export async function createStory(
  userId: string,
  input: { body: string; mediaUrl?: string | undefined },
) {
  if (input.mediaUrl && !isHttpsUrl(input.mediaUrl)) {
    throw new SocialError("Media URLs must use https.", "INVALID");
  }
  const publicRef = await uniqueRef("story");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.story.create({
    data: {
      publicRef,
      authorUserId: userId,
      body: input.body,
      mediaUrl: input.mediaUrl ?? null,
      expiresAt,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.STORY_CREATED,
    targetType: "Story",
    targetId: publicRef,
    metadata: { publicRef },
  });
  return { publicRef };
}

export async function listStories(viewerUserId?: string | undefined) {
  const now = new Date();
  const blocked = viewerUserId ? await blockedSet(viewerUserId) : new Set<string>();
  const following = viewerUserId
    ? await prisma.userFollow.findMany({
        where: { followerUserId: viewerUserId },
        select: { followingUserId: true },
      })
    : [];
  const authorIds = following.map((row) => row.followingUserId);
  if (viewerUserId) {
    authorIds.push(viewerUserId);
  }
  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: now },
      ...(viewerUserId ? { authorUserId: { in: authorIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      author: { select: authorSelect },
      views: viewerUserId ? { where: { userId: viewerUserId } } : false,
    },
  });
  return stories
    .filter((story) => isStoryActive(story.expiresAt, now) && !blocked.has(story.authorUserId))
    .map((story) => ({
      publicRef: story.publicRef,
      body: story.body,
      mediaUrl: story.mediaUrl,
      expiresAt: story.expiresAt.toISOString(),
      seen: Array.isArray(story.views) && story.views.length > 0,
      isSelf: story.authorUserId === viewerUserId,
      author: {
        handle: story.author.profile?.handle ?? "player",
        name: displayName(story.author),
      },
    }));
}

export async function getStory(publicRef: string, viewerUserId?: string | undefined) {
  const story = await prisma.story.findUnique({
    where: { publicRef },
    include: { author: { select: authorSelect } },
  });
  if (!story || !isStoryActive(story.expiresAt, new Date())) {
    throw new SocialError("Story not found.", "NOT_FOUND");
  }
  if (viewerUserId) {
    const blocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: viewerUserId, blockedUserId: story.authorUserId },
          { blockerUserId: story.authorUserId, blockedUserId: viewerUserId },
        ],
      },
    });
    if (blocked) {
      throw new SocialError("Story not found.", "NOT_FOUND");
    }
    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId: story.id, userId: viewerUserId } },
      update: {},
      create: { storyId: story.id, userId: viewerUserId },
    });
  }
  return {
    publicRef: story.publicRef,
    body: story.body,
    mediaUrl: story.mediaUrl,
    expiresAt: story.expiresAt.toISOString(),
    author: {
      handle: story.author.profile?.handle ?? "player",
      name: displayName(story.author),
    },
  };
}

export async function viewStory(userId: string, publicRef: string) {
  return getStory(publicRef, userId);
}

export async function createReport(
  userId: string,
  input: { targetType: "POST" | "COMMENT" | "STORY" | "USER"; targetRef: string; reason: string },
) {
  const publicRef = await uniqueRef("report");
  await prisma.contentReport.create({
    data: {
      publicRef,
      reporterUserId: userId,
      targetType: input.targetType,
      targetRef: input.targetRef,
      reason: input.reason,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CONTENT_REPORTED,
    targetType: input.targetType,
    targetId: input.targetRef,
    metadata: { publicRef },
  });
  return { publicRef };
}

export async function hidePost(actorUserId: string, publicRef: string) {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  const types = actor?.kobaIdentities.map((row) => row.accountType) ?? [];
  if (!canModerateSocial(types)) {
    throw new SocialError("Staff only.", "FORBIDDEN");
  }
  const post = await prisma.post.findUnique({ where: { publicRef } });
  if (!post) {
    throw new SocialError("Post not found.", "NOT_FOUND");
  }
  await prisma.post.update({
    where: { id: post.id },
    data: { moderationStatus: "HIDDEN" },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditAction.CONTENT_HIDDEN,
    targetType: "Post",
    targetId: post.id,
    metadata: { publicRef },
  });
  return { publicRef, status: "HIDDEN" as const };
}
