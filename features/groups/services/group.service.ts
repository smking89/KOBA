import { randomBytes } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { GroupError } from "@/features/groups/lib/errors";
import {
  canInviteToGroup,
  canJoinPublicGroup,
  canKickOrBan,
  canModerateMembership,
  canRequestPrivateGroup,
  canSetGroupRole,
  canViewPrivateGroup,
  slugifyGroup,
  type GroupMemberRole,
} from "@/features/groups/lib/access";
import type { CreateGroupInput, GroupModerateInput } from "@/features/groups/schemas/group.schemas";

const userPublic = {
  id: true,
  name: true,
  profile: { select: { displayName: true } },
  kobaIdentities: { select: { code: true, accountType: true }, take: 4 },
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

function toMember(
  user: {
    name: string | null;
    profile: { displayName: string | null } | null;
    kobaIdentities: { code: string }[];
  },
  role: GroupMemberRole,
) {
  return {
    name: displayName(user),
    kobaId: publicKobaId(user),
    role,
  };
}

async function uniqueSlug(name: string): Promise<string> {
  let slug = slugifyGroup(name);
  const clash = await prisma.group.findUnique({ where: { slug } });
  if (clash) {
    slug = `${slug}-${randomBytes(2).toString("hex")}`;
  }
  return slug;
}

async function findUserByKobaId(code: string) {
  const identity = await prisma.kobaIdentity.findUnique({
    where: { code },
    include: { user: { select: userPublic } },
  });
  if (!identity) {
    throw new GroupError("No account found for that KOBAID.", "NOT_FOUND");
  }
  return identity.user;
}

async function loadGroupBySlug(slug: string) {
  const group = await prisma.group.findUnique({
    where: { slug },
    include: {
      owner: { select: userPublic },
      members: { include: { user: { select: userPublic } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!group) {
    throw new GroupError("Group not found.", "NOT_FOUND");
  }
  return group;
}

function actorRole(
  group: { ownerUserId: string; members: { userId: string; role: GroupMemberRole }[] },
  userId: string | undefined,
): GroupMemberRole | null {
  if (!userId) {
    return null;
  }
  return group.members.find((row) => row.userId === userId)?.role ?? null;
}

export async function createGroup(
  userId: string,
  input: CreateGroupInput,
  ipAddress?: string | null,
) {
  const slug = await uniqueSlug(input.name);
  const group = await prisma.group.create({
    data: {
      slug,
      name: input.name,
      bio: input.bio,
      visibility: input.visibility,
      ownerUserId: userId,
      members: { create: { userId, role: "OWNER" } },
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.GROUP_CREATED,
    targetType: "Group",
    targetId: group.id,
    metadata: { slug, visibility: input.visibility },
    ipAddress: ipAddress ?? null,
  });
  return { slug: group.slug, name: group.name };
}

export async function listGroups(viewerUserId?: string) {
  const [groups, memberships] = await Promise.all([
    prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      take: 48,
      include: { _count: { select: { members: true } } },
    }),
    viewerUserId
      ? prisma.groupMember.findMany({ where: { userId: viewerUserId }, select: { groupId: true } })
      : Promise.resolve([] as { groupId: string }[]),
  ]);
  const joinedIds = new Set(memberships.map((row) => row.groupId));

  return groups
    .filter((group) => group.visibility === "PUBLIC" || joinedIds.has(group.id))
    .map((group) => ({
      slug: group.slug,
      name: group.name,
      bio: group.bio,
      visibility: group.visibility,
      memberCount: group._count.members,
      joined: joinedIds.has(group.id),
    }));
}

export async function countJoinedGroups(userId: string): Promise<number> {
  return prisma.groupMember.count({ where: { userId } });
}

export async function getGroup(slug: string, viewerUserId?: string) {
  const group = await loadGroupBySlug(slug);
  const role = actorRole(group, viewerUserId);
  const isMember = role != null;

  const invite = viewerUserId
    ? await prisma.groupInvitation.findUnique({
        where: { groupId_invitedUserId: { groupId: group.id, invitedUserId: viewerUserId } },
      })
    : null;
  const hasPendingInvite = invite?.status === "PENDING";

  if (group.visibility === "PRIVATE" && !canViewPrivateGroup({ isMember, hasPendingInvite })) {
    throw new GroupError("Group not found.", "NOT_FOUND");
  }

  const pendingRequest = viewerUserId
    ? await prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: viewerUserId } },
      })
    : null;

  const banned = viewerUserId
    ? Boolean(
        await prisma.groupBan.findUnique({
          where: { groupId_userId: { groupId: group.id, userId: viewerUserId } },
        }),
      )
    : false;

  const canManage = canModerateMembership(role);
  const requests = canManage
    ? await prisma.groupJoinRequest.findMany({
        where: { groupId: group.id, status: "PENDING" },
        include: { user: { select: userPublic } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const bans = canManage
    ? await prisma.groupBan.findMany({
        where: { groupId: group.id },
        include: { user: { select: userPublic } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return {
    slug: group.slug,
    name: group.name,
    bio: group.bio,
    visibility: group.visibility,
    taggingAllowed: group.taggingAllowed,
    memberCount: group.members.length,
    viewerRole: role,
    joined: isMember,
    banned,
    pendingRequest: pendingRequest?.status === "PENDING",
    pendingInvite: hasPendingInvite,
    canInvite: canInviteToGroup(role),
    canModerate: canManage,
    members: group.members.map((row) => toMember(row.user, row.role)),
    requests: requests.map((row) => ({
      name: displayName(row.user),
      kobaId: publicKobaId(row.user),
    })),
    bans: bans.map((row) => ({
      name: displayName(row.user),
      kobaId: publicKobaId(row.user),
    })),
  };
}

export async function joinGroup(userId: string, slug: string, ipAddress?: string | null) {
  const group = await loadGroupBySlug(slug);
  const role = actorRole(group, userId);
  if (role) {
    throw new GroupError("You are already a member.", "ALREADY_MEMBER");
  }

  const banned = await prisma.groupBan.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (banned) {
    throw new GroupError("You are banned from this group.", "BANNED");
  }

  const invite = await prisma.groupInvitation.findUnique({
    where: { groupId_invitedUserId: { groupId: group.id, invitedUserId: userId } },
  });

  if (invite?.status === "PENDING" || group.visibility === "PUBLIC") {
    if (
      group.visibility === "PUBLIC" &&
      !invite &&
      !canJoinPublicGroup({ alreadyMember: false, banned: false })
    ) {
      throw new GroupError("You cannot join this group.", "FORBIDDEN");
    }
    await prisma.$transaction(async (tx) => {
      await tx.groupMember.create({ data: { groupId: group.id, userId, role: "MEMBER" } });
      if (invite?.status === "PENDING") {
        await tx.groupInvitation.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED" },
        });
      }
      await tx.groupJoinRequest.updateMany({
        where: { groupId: group.id, userId, status: "PENDING" },
        data: { status: "APPROVED" },
      });
    });
    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.GROUP_JOINED,
      targetType: "Group",
      targetId: group.id,
      metadata: { slug },
      ipAddress: ipAddress ?? null,
    });
    return { joined: true, requested: false };
  }

  const existingRequest = await prisma.groupJoinRequest.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (
    !canRequestPrivateGroup({
      alreadyMember: false,
      banned: false,
      pendingRequest: existingRequest?.status === "PENDING",
    })
  ) {
    throw new GroupError("A join request is already pending.", "CONFLICT");
  }

  await prisma.groupJoinRequest.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: { status: "PENDING" },
    create: { groupId: group.id, userId, status: "PENDING" },
  });
  return { joined: false, requested: true };
}

export async function leaveGroup(userId: string, slug: string, ipAddress?: string | null) {
  const group = await loadGroupBySlug(slug);
  const role = actorRole(group, userId);
  if (!role) {
    throw new GroupError("You are not a member of this group.", "NOT_FOUND");
  }
  if (role === "OWNER") {
    throw new GroupError("The owner cannot leave the group.", "FORBIDDEN");
  }
  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.GROUP_LEFT,
    targetType: "Group",
    targetId: group.id,
    metadata: { slug },
    ipAddress: ipAddress ?? null,
  });
  return { left: true };
}

export async function moderateGroup(
  actorUserId: string,
  slug: string,
  input: GroupModerateInput,
  ipAddress?: string | null,
) {
  const group = await loadGroupBySlug(slug);
  const actor = actorRole(group, actorUserId);
  const target = await findUserByKobaId(input.kobaId);

  if (input.action === "invite") {
    if (!canInviteToGroup(actor)) {
      throw new GroupError("Only group admins can invite.", "FORBIDDEN");
    }
    if (target.id === actorUserId) {
      throw new GroupError("You cannot invite yourself.", "INVALID");
    }
    if (group.members.some((row) => row.userId === target.id)) {
      throw new GroupError("That player is already a member.", "ALREADY_MEMBER");
    }
    const banned = await prisma.groupBan.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: target.id } },
    });
    if (banned) {
      throw new GroupError("That player is banned from this group.", "BANNED");
    }
    await prisma.groupInvitation.upsert({
      where: { groupId_invitedUserId: { groupId: group.id, invitedUserId: target.id } },
      update: { status: "PENDING", invitedByUserId: actorUserId },
      create: {
        groupId: group.id,
        invitedUserId: target.id,
        invitedByUserId: actorUserId,
      },
    });
    await writeAuditLog({
      actorUserId: actorUserId,
      action: AuditAction.GROUP_MODERATED,
      targetType: "Group",
      targetId: group.id,
      metadata: { slug, action: "invite", kobaId: input.kobaId },
      ipAddress: ipAddress ?? null,
    });
    return { ok: true };
  }

  if (input.action === "unban") {
    if (!canModerateMembership(actor)) {
      throw new GroupError("Only group moderators can unban.", "FORBIDDEN");
    }
    await prisma.groupBan.deleteMany({
      where: { groupId: group.id, userId: target.id },
    });
    return { ok: true };
  }

  if (input.action === "approve" || input.action === "deny") {
    if (!canModerateMembership(actor)) {
      throw new GroupError("Only group moderators can review requests.", "FORBIDDEN");
    }
    const request = await prisma.groupJoinRequest.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: target.id } },
    });
    if (!request || request.status !== "PENDING") {
      throw new GroupError("No pending request for that KOBAID.", "NOT_FOUND");
    }
    if (input.action === "deny") {
      await prisma.groupJoinRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED" },
      });
      return { ok: true };
    }
    await prisma.$transaction(async (tx) => {
      await tx.groupJoinRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED" },
      });
      await tx.groupMember.create({
        data: { groupId: group.id, userId: target.id, role: "MEMBER" },
      });
    });
    return { ok: true };
  }

  const targetRole = actorRole(group, target.id);

  if (input.action === "kick" || input.action === "ban") {
    if (!canKickOrBan({ actorRole: actor, targetRole })) {
      throw new GroupError("You cannot moderate that member.", "FORBIDDEN");
    }
    await prisma.$transaction(async (tx) => {
      await tx.groupMember.deleteMany({ where: { groupId: group.id, userId: target.id } });
      await tx.groupJoinRequest.deleteMany({ where: { groupId: group.id, userId: target.id } });
      await tx.groupInvitation.deleteMany({
        where: { groupId: group.id, invitedUserId: target.id },
      });
      if (input.action === "ban") {
        await tx.groupBan.upsert({
          where: { groupId_userId: { groupId: group.id, userId: target.id } },
          update: { bannedByUserId: actorUserId },
          create: { groupId: group.id, userId: target.id, bannedByUserId: actorUserId },
        });
      }
    });
    await writeAuditLog({
      actorUserId: actorUserId,
      action: AuditAction.GROUP_MODERATED,
      targetType: "Group",
      targetId: group.id,
      metadata: { slug, action: input.action, kobaId: input.kobaId },
      ipAddress: ipAddress ?? null,
    });
    return { ok: true };
  }

  if (input.action === "set_role") {
    const nextRole = input.role;
    if (!nextRole || nextRole === "OWNER") {
      throw new GroupError("Choose Admin, Moderator, or Member.", "INVALID");
    }
    if (!canSetGroupRole({ actorRole: actor, targetRole, nextRole })) {
      throw new GroupError("You cannot assign that role.", "FORBIDDEN");
    }
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId: group.id, userId: target.id } },
      data: { role: nextRole },
    });
    await writeAuditLog({
      actorUserId: actorUserId,
      action: AuditAction.GROUP_MODERATED,
      targetType: "Group",
      targetId: group.id,
      metadata: { slug, action: "set_role", kobaId: input.kobaId, role: nextRole },
      ipAddress: ipAddress ?? null,
    });
    return { ok: true };
  }

  throw new GroupError("Unknown moderation action.", "INVALID");
}
