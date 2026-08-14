import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { LfgError } from "@/features/lfg/lib/errors";
import { generateLfgRef } from "@/features/lfg/lib/lfg-ref";
import {
  canAcceptLfgRequest,
  canRequestLfgSeat,
  nextFilledCount,
  resolveLfgStatus,
  type LfgStatus,
} from "@/features/lfg/lib/rules";
import type { CreateLfgInput, LfgQuery } from "@/features/lfg/schemas/lfg.schemas";

const userPublic = {
  id: true,
  name: true,
  profile: { select: { displayName: true } },
  kobaIdentities: { select: { code: true }, take: 4 },
} as const;

function displayName(user: {
  name: string | null;
  profile: { displayName: string | null } | null;
}): string {
  return user.profile?.displayName ?? user.name ?? "Player";
}

function publicKobaId(user: { kobaIdentities: { code: string }[] }): string | null {
  return user.kobaIdentities[0]?.code ?? null;
}

async function allocateLfgRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateLfgRef();
    const clash = await prisma.lfgPost.findUnique({ where: { publicRef } });
    if (!clash) {
      return publicRef;
    }
  }
  throw new LfgError("Could not allocate an LFG reference.", "CONFLICT");
}

function overlayStatus(
  post: {
    status: LfgStatus;
    expiresAt: Date;
    slotsFilled: number;
    slotsTotal: number;
  },
  now = new Date(),
): LfgStatus {
  return resolveLfgStatus({ ...post, now });
}

export async function createLfgPost(
  userId: string,
  input: CreateLfgInput,
  ipAddress?: string | null,
) {
  const game = await prisma.game.findUnique({ where: { slug: input.gameSlug } });
  if (!game) {
    throw new LfgError("Unknown game.", "INVALID");
  }
  const publicRef = await allocateLfgRef();
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
  const post = await prisma.lfgPost.create({
    data: {
      publicRef,
      authorUserId: userId,
      title: input.title,
      body: input.body,
      gameId: game.id,
      platform: input.platform,
      region: input.region,
      timezone: input.timezone,
      skillLevel: input.skillLevel,
      mic: input.mic,
      availability: input.availability,
      slotsTotal: input.slotsTotal,
      slotsFilled: 1,
      expiresAt,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.LFG_CREATED,
    targetType: "LfgPost",
    targetId: post.id,
    metadata: { publicRef },
    ipAddress: ipAddress ?? null,
  });
  return { publicRef: post.publicRef };
}

export async function listLfgPosts(query: LfgQuery, viewerUserId?: string) {
  const game = query.game ? await prisma.game.findUnique({ where: { slug: query.game } }) : null;
  if (query.game && !game) {
    return [];
  }

  const now = new Date();
  const posts = await prisma.lfgPost.findMany({
    where: {
      ...(game ? { gameId: game.id } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.region ? { region: query.region } : {}),
      ...(query.skill ? { skillLevel: query.skill } : {}),
      ...(query.mic ? { mic: query.mic } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { body: { contains: query.q, mode: "insensitive" } },
              { availability: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 48,
    include: {
      game: { select: { slug: true, name: true } },
      author: { select: userPublic },
      requests: viewerUserId
        ? { where: { userId: viewerUserId }, select: { status: true } }
        : false,
    },
  });

  return posts.map((post) => {
    const status = overlayStatus(post, now);
    const viewerRequest = Array.isArray(post.requests) ? post.requests[0] : undefined;
    return {
      publicRef: post.publicRef,
      title: post.title,
      body: post.body,
      game: post.game,
      platform: post.platform,
      region: post.region,
      timezone: post.timezone,
      skillLevel: post.skillLevel,
      mic: post.mic,
      availability: post.availability,
      slotsTotal: post.slotsTotal,
      slotsFilled: post.slotsFilled,
      status,
      expiresAt: post.expiresAt.toISOString(),
      author: {
        name: displayName(post.author),
        kobaId: publicKobaId(post.author),
      },
      isAuthor: viewerUserId === post.authorUserId,
      viewerRequest: viewerRequest?.status ?? null,
    };
  });
}

export async function getLfgPost(publicRef: string, viewerUserId?: string) {
  const post = await prisma.lfgPost.findUnique({
    where: { publicRef },
    include: {
      game: { select: { slug: true, name: true } },
      author: { select: userPublic },
      requests: {
        include: { user: { select: userPublic } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!post) {
    throw new LfgError("LFG post not found.", "NOT_FOUND");
  }
  const now = new Date();
  const status = overlayStatus(post, now);
  const isAuthor = viewerUserId === post.authorUserId;
  return {
    publicRef: post.publicRef,
    title: post.title,
    body: post.body,
    game: post.game,
    platform: post.platform,
    region: post.region,
    timezone: post.timezone,
    skillLevel: post.skillLevel,
    mic: post.mic,
    availability: post.availability,
    slotsTotal: post.slotsTotal,
    slotsFilled: post.slotsFilled,
    status,
    expiresAt: post.expiresAt.toISOString(),
    author: { name: displayName(post.author), kobaId: publicKobaId(post.author) },
    isAuthor,
    viewerRequest: post.requests.find((row) => row.userId === viewerUserId)?.status ?? null,
    requests: isAuthor
      ? post.requests.map((row) => ({
          name: displayName(row.user),
          kobaId: publicKobaId(row.user),
          status: row.status,
        }))
      : [],
  };
}

export async function requestLfgSeat(userId: string, publicRef: string, ipAddress?: string | null) {
  const post = await prisma.lfgPost.findUnique({ where: { publicRef } });
  if (!post) {
    throw new LfgError("LFG post not found.", "NOT_FOUND");
  }
  const status = overlayStatus(post);
  if (userId === post.authorUserId) {
    throw new LfgError("You cannot request a seat on your own post.", "SELF_JOIN");
  }
  const existing = await prisma.lfgRequest.findUnique({
    where: { postId_userId: { postId: post.id, userId } },
  });
  if (
    !canRequestLfgSeat({
      viewerUserId: userId,
      authorUserId: post.authorUserId,
      status,
      alreadyRequested: Boolean(existing),
    })
  ) {
    if (existing) {
      throw new LfgError("You already requested this party.", "CONFLICT");
    }
    throw new LfgError("This party is not open.", "CLOSED");
  }
  await prisma.lfgRequest.create({
    data: { postId: post.id, userId, status: "PENDING" },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.LFG_JOIN_REQUESTED,
    targetType: "LfgPost",
    targetId: post.id,
    metadata: { publicRef },
    ipAddress: ipAddress ?? null,
  });
  return { requested: true };
}

export async function moderateLfgPost(
  actorUserId: string,
  publicRef: string,
  input: { action: "accept" | "deny" | "cancel"; kobaId?: string | undefined },
  ipAddress?: string | null,
) {
  const post = await prisma.lfgPost.findUnique({
    where: { publicRef },
    include: {
      requests: {
        include: { user: { select: { id: true, kobaIdentities: { select: { code: true } } } } },
      },
    },
  });
  if (!post) {
    throw new LfgError("LFG post not found.", "NOT_FOUND");
  }
  if (post.authorUserId !== actorUserId) {
    throw new LfgError("Only the author can manage this post.", "FORBIDDEN");
  }

  if (input.action === "cancel") {
    await prisma.lfgPost.update({
      where: { id: post.id },
      data: { status: "CANCELLED" },
    });
    return { ok: true };
  }

  if (!input.kobaId) {
    throw new LfgError("KOBAID is required.", "INVALID");
  }
  const request = post.requests.find((row) =>
    row.user.kobaIdentities.some((identity) => identity.code === input.kobaId),
  );
  if (!request) {
    throw new LfgError("No request from that KOBAID.", "NOT_FOUND");
  }

  const status = overlayStatus(post);
  if (input.action === "deny") {
    if (request.status !== "PENDING") {
      throw new LfgError("That request is not pending.", "CONFLICT");
    }
    await prisma.lfgRequest.update({
      where: { id: request.id },
      data: { status: "DECLINED" },
    });
    return { ok: true };
  }

  if (
    !canAcceptLfgRequest({
      actorUserId,
      authorUserId: post.authorUserId,
      status,
      requestStatus: request.status,
    })
  ) {
    throw new LfgError("This party cannot accept more players.", "CLOSED");
  }

  const filled = nextFilledCount(post.slotsFilled, post.slotsTotal);
  await prisma.$transaction(async (tx) => {
    await tx.lfgRequest.update({
      where: { id: request.id },
      data: { status: "ACCEPTED" },
    });
    await tx.lfgPost.update({
      where: { id: post.id },
      data: { slotsFilled: filled.slotsFilled, status: filled.status },
    });
  });
  await writeAuditLog({
    actorUserId,
    action: AuditAction.LFG_SETTLED,
    targetType: "LfgPost",
    targetId: post.id,
    metadata: { publicRef, kobaId: input.kobaId, status: filled.status },
    ipAddress: ipAddress ?? null,
  });
  return { ok: true, status: filled.status };
}
