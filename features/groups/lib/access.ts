export function slugifyGroup(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "group";
}

export const GROUP_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type GroupVisibility = (typeof GROUP_VISIBILITIES)[number];

export const GROUP_MEMBER_ROLES = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] as const;
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLES)[number];

export const GROUP_ROLE_RANK: Record<GroupMemberRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MODERATOR: 2,
  MEMBER: 1,
};

/** Group Admin/Moderator are community roles, never KOBA staff (SA/AD/MD). */
export function isGroupCommunityRole(role: string): role is GroupMemberRole {
  return (GROUP_MEMBER_ROLES as readonly string[]).includes(role);
}

export function groupRoleRank(role: GroupMemberRole | null | undefined): number {
  if (!role) {
    return 0;
  }
  return GROUP_ROLE_RANK[role];
}

export function canJoinPublicGroup(input: { alreadyMember: boolean; banned: boolean }): boolean {
  return !input.alreadyMember && !input.banned;
}

export function canRequestPrivateGroup(input: {
  alreadyMember: boolean;
  banned: boolean;
  pendingRequest: boolean;
}): boolean {
  return !input.alreadyMember && !input.banned && !input.pendingRequest;
}

export function canInviteToGroup(actorRole: GroupMemberRole | null): boolean {
  return groupRoleRank(actorRole) >= GROUP_ROLE_RANK.ADMIN;
}

export function canModerateMembership(actorRole: GroupMemberRole | null): boolean {
  return groupRoleRank(actorRole) >= GROUP_ROLE_RANK.MODERATOR;
}

export function canKickOrBan(input: {
  actorRole: GroupMemberRole | null;
  targetRole: GroupMemberRole | null;
}): boolean {
  if (!canModerateMembership(input.actorRole)) {
    return false;
  }
  return groupRoleRank(input.actorRole) > groupRoleRank(input.targetRole);
}

export function canSetGroupRole(input: {
  actorRole: GroupMemberRole | null;
  targetRole: GroupMemberRole | null;
  nextRole: GroupMemberRole;
}): boolean {
  if (input.nextRole === "OWNER" || input.targetRole === "OWNER") {
    return false;
  }
  if (input.actorRole === "OWNER") {
    return (
      input.nextRole === "ADMIN" || input.nextRole === "MODERATOR" || input.nextRole === "MEMBER"
    );
  }
  if (input.actorRole === "ADMIN") {
    return (
      groupRoleRank(input.targetRole) <= GROUP_ROLE_RANK.MODERATOR &&
      (input.nextRole === "MODERATOR" || input.nextRole === "MEMBER")
    );
  }
  return false;
}

export function canViewPrivateGroup(input: {
  isMember: boolean;
  hasPendingInvite: boolean;
}): boolean {
  return input.isMember || input.hasPendingInvite;
}
