import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { MessageError } from "@/features/messages/lib/errors";
import { publishConversation, getTyping, setTyping } from "@/features/messages/lib/events";
import { generateConversationRef, generateMessageRef } from "@/features/messages/lib/refs";
import {
  canMessageUser,
  conversationPairKey,
  isHttpsMediaUrl,
  shouldPersistVanish,
  unreadCount,
} from "@/features/messages/lib/rules";
import type { SendMessageInput } from "@/features/messages/schemas/message.schemas";
import { generateReportRef } from "@/features/social/lib/refs";

const peerSelect = {
  id: true,
  name: true,
  profile: { select: { handle: true, displayName: true } },
  kobaIdentities: { select: { code: true }, take: 1 },
} as const;

function displayName(user: {
  name: string | null;
  profile: { displayName: string | null; handle: string | null } | null;
}): string {
  return user.profile?.displayName ?? user.name ?? "Player";
}

async function uniqueConversationRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateConversationRef();
    const clash = await prisma.conversation.findUnique({ where: { publicRef } });
    if (!clash) {
      return publicRef;
    }
  }
  throw new MessageError("Could not allocate a conversation reference.", "CONFLICT");
}

async function uniqueMessageRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateMessageRef();
    const clash = await prisma.directMessage.findUnique({ where: { publicRef } });
    if (!clash) {
      return publicRef;
    }
  }
  throw new MessageError("Could not allocate a message reference.", "CONFLICT");
}

async function isBlocked(a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: a, blockedUserId: b },
        { blockerUserId: b, blockedUserId: a },
      ],
    },
  });
  return Boolean(row);
}

async function requireMembership(userId: string, publicRef: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { publicRef },
    include: {
      participants: { include: { user: { select: peerSelect } } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { senderUserId: true, createdAt: true, body: true, kind: true },
      },
    },
  });
  if (!conversation) {
    throw new MessageError("Conversation not found.", "NOT_FOUND");
  }
  const self = conversation.participants.find((row) => row.userId === userId);
  if (!self) {
    throw new MessageError("Conversation not found.", "NOT_FOUND");
  }
  const peer = conversation.participants.find((row) => row.userId !== userId);
  if (!peer) {
    throw new MessageError("Conversation is incomplete.", "CONFLICT");
  }
  if (await isBlocked(userId, peer.userId)) {
    throw new MessageError("You cannot message this account.", "BLOCKED");
  }
  return { conversation, self, peer };
}

function toPeerDto(user: {
  name: string | null;
  profile: { handle: string | null; displayName: string | null } | null;
  kobaIdentities: { code: string }[];
}) {
  return {
    handle: user.profile?.handle ?? "player",
    name: displayName(user),
    kobaId: user.kobaIdentities[0]?.code ?? null,
  };
}

export async function listInbox(userId: string) {
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: { include: { user: { select: peerSelect } } },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return memberships
    .map((membership) => {
      const peer = membership.conversation.participants.find((row) => row.userId !== userId);
      if (!peer) {
        return null;
      }
      const last = membership.conversation.messages[0] ?? null;
      return {
        publicRef: membership.conversation.publicRef,
        vanishMode: membership.conversation.vanishMode,
        peer: toPeerDto(peer.user),
        lastMessage: last
          ? {
              kind: last.kind,
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              fromSelf: last.senderUserId === userId,
            }
          : null,
        unread: unreadCount({
          lastReadAt: membership.lastReadAt,
          lastMessageAt: membership.conversation.lastMessageAt,
          lastMessageFromSelf: last?.senderUserId === userId,
        }),
        updatedAt: (
          membership.conversation.lastMessageAt ?? membership.conversation.createdAt
        ).toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function openConversation(userId: string, handle: string, ipAddress?: string | null) {
  const profile = await prisma.accountProfile.findUnique({
    where: { handle: handle.toLowerCase() },
    include: { user: { select: peerSelect } },
  });
  if (!profile) {
    throw new MessageError("Profile not found.", "NOT_FOUND");
  }
  const blocked = await isBlocked(userId, profile.userId);
  if (!canMessageUser({ actorUserId: userId, targetUserId: profile.userId, blocked })) {
    throw new MessageError(
      blocked ? "You cannot message this account." : "You cannot message yourself.",
      blocked ? "BLOCKED" : "INVALID",
    );
  }

  const pairKey = conversationPairKey(userId, profile.userId);
  const existing = await prisma.conversation.findUnique({ where: { pairKey } });
  if (existing) {
    return { publicRef: existing.publicRef, created: false };
  }

  const publicRef = await uniqueConversationRef();
  await prisma.conversation.create({
    data: {
      publicRef,
      pairKey,
      participants: {
        create: [{ userId }, { userId: profile.userId }],
      },
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CONVERSATION_STARTED,
    targetType: "Conversation",
    targetId: publicRef,
    metadata: { peerHandle: profile.handle },
    ipAddress: ipAddress ?? null,
  });
  return { publicRef, created: true };
}

export async function getThread(userId: string, publicRef: string) {
  const { conversation, self, peer } = await requireMembership(userId, publicRef);
  const messages = await prisma.directMessage.findMany({
    where: { conversationId: conversation.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return {
    publicRef: conversation.publicRef,
    vanishMode: conversation.vanishMode,
    peer: toPeerDto(peer.user),
    typing: getTyping(conversation.publicRef, self.user.profile?.handle ?? undefined),
    messages: messages.map((message) => ({
      publicRef: message.publicRef,
      kind: message.kind,
      body: message.body,
      vanish: message.vanish,
      mediaUrl: message.mediaUrl,
      mediaDurationMs: message.mediaDurationMs,
      productSlug: message.productSlug,
      fromSelf: message.senderUserId === userId,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function sendMessage(
  userId: string,
  publicRef: string,
  input: SendMessageInput,
  ipAddress?: string | null,
) {
  const { conversation } = await requireMembership(userId, publicRef);

  if (input.mediaUrl && !isHttpsMediaUrl(input.mediaUrl)) {
    throw new MessageError("Media URLs must use https.", "INVALID");
  }
  if (input.kind === "PRODUCT" && input.productSlug) {
    const product = await prisma.product.findUnique({ where: { slug: input.productSlug } });
    if (!product || product.moderationStatus !== "APPROVED" || product.publishedAt == null) {
      throw new MessageError("Product not available.", "NOT_FOUND");
    }
  }

  const vanish = shouldPersistVanish(conversation.vanishMode, input.vanish);
  const messageRef = await uniqueMessageRef();
  const message = await prisma.directMessage.create({
    data: {
      publicRef: messageRef,
      conversationId: conversation.id,
      senderUserId: userId,
      kind: input.kind,
      body: input.body ?? null,
      vanish,
      mediaUrl: input.mediaUrl ?? null,
      mediaDurationMs: input.mediaDurationMs ?? null,
      productSlug: input.productSlug ?? null,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: message.createdAt },
  });
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: conversation.id, userId } },
    data: { lastReadAt: message.createdAt },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.MESSAGE_SENT,
    targetType: "DirectMessage",
    targetId: message.publicRef,
    metadata: { conversationRef: publicRef, kind: input.kind, vanish },
    ipAddress: ipAddress ?? null,
  });
  publishConversation({ type: "message", conversationRef: publicRef });
  return { publicRef: message.publicRef };
}

export async function markRead(userId: string, publicRef: string) {
  const { conversation } = await requireMembership(userId, publicRef);
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: conversation.id, userId } },
    data: { lastReadAt: new Date() },
  });
  publishConversation({ type: "read", conversationRef: publicRef });
  return { ok: true };
}

export async function signalTyping(userId: string, publicRef: string) {
  const { self } = await requireMembership(userId, publicRef);
  const handle = self.user.profile?.handle ?? "player";
  setTyping(publicRef, handle);
  return { ok: true };
}

export async function setVanishMode(userId: string, publicRef: string, vanishMode: boolean) {
  const { conversation } = await requireMembership(userId, publicRef);
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { vanishMode },
  });
  publishConversation({ type: "vanish", conversationRef: publicRef, vanishMode });
  return { vanishMode };
}

export async function leaveAndPurgeVanish(userId: string, publicRef: string) {
  const { conversation } = await requireMembership(userId, publicRef);
  const result = await prisma.directMessage.updateMany({
    where: { conversationId: conversation.id, vanish: true, deletedAt: null },
    data: { deletedAt: new Date(), body: null, mediaUrl: null },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.VANISH_PURGED,
    targetType: "Conversation",
    targetId: publicRef,
    metadata: { purged: result.count },
  });
  publishConversation({ type: "purge", conversationRef: publicRef });
  return { purged: result.count };
}

export async function reportConversation(
  userId: string,
  publicRef: string,
  input: { reason: string; messageRef?: string | undefined },
) {
  await requireMembership(userId, publicRef);
  const reportRef = generateReportRef();
  await prisma.contentReport.create({
    data: {
      publicRef: reportRef,
      reporterUserId: userId,
      targetType: input.messageRef ? "MESSAGE" : "CONVERSATION",
      targetRef: input.messageRef ?? publicRef,
      reason: input.reason,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CONTENT_REPORTED,
    targetType: input.messageRef ? "MESSAGE" : "CONVERSATION",
    targetId: input.messageRef ?? publicRef,
    metadata: { publicRef: reportRef },
  });
  return { publicRef: reportRef };
}
