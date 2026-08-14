import { CommunityRole } from '../accounts/community-role.types';

/** Base class for all typed groups domain errors. */
export abstract class GroupDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GroupNotFoundError extends GroupDomainError {
  constructor(groupId: string) {
    super(`Group "${groupId}" was not found`);
  }
}

/** Thrown when a caller who isn't a member of `groupId` tries to do
 * something that requires membership (post to the feed, read a private
 * group's feed, etc). */
export class NotGroupMemberError extends GroupDomainError {
  constructor(groupId: string, kobaId: string) {
    super(`KOBAID "${kobaId}" is not a member of group "${groupId}"`);
  }
}

/** Thrown by `GroupFeedService#getGroupFeed()` when the group is private
 * and the requester isn't a member (public groups never throw this). */
export class PrivateGroupRequiresMembershipError extends GroupDomainError {
  constructor(groupId: string) {
    super(`Group "${groupId}" is private — membership is required to view its feed`);
  }
}

/**
 * Thrown by `GroupMembershipService#join()` when a KOBAID tries to
 * self-join a private group. There is no invite-code/request-to-join flow
 * in this phase (see groups/README.md's TODOs) — a private group's
 * owner/admin must add members directly via `addMember()`.
 */
export class PrivateGroupJoinRequiresInviteError extends GroupDomainError {
  constructor(groupId: string) {
    super(
      `Group "${groupId}" is private — it cannot be self-joined; an owner/admin must add members via addMember()`,
    );
  }
}

/** Thrown when a caller who isn't the group's owner/admin tries to manage
 * membership (add a member, promote/demote a role, toggle allowTagging). */
export class InsufficientGroupRoleError extends GroupDomainError {
  constructor(groupId: string, callerKobaId: string) {
    super(`KOBAID "${callerKobaId}" is not an owner/admin of group "${groupId}"`);
  }
}

/** Thrown when a role change targets the group's owner — the owner can
 * never be demoted or have their role otherwise changed here (ownership
 * transfer is out of scope this phase). */
export class CannotModifyOwnerRoleError extends GroupDomainError {
  constructor(groupId: string, targetKobaId: string) {
    super(`KOBAID "${targetKobaId}" is group "${groupId}"'s owner — their role cannot be changed`);
  }
}

/** Thrown when a role change attempts to assign the `owner` role — there
 * is no ownership-transfer path in this phase. */
export class CannotAssignOwnerRoleError extends GroupDomainError {
  constructor(groupId: string) {
    super(`Group "${groupId}" already has an owner — the owner role cannot be (re)assigned`);
  }
}

/** Thrown when a caller tries to assign a role at or above their own rank
 * (owner > admin > moderator > member) — e.g. an admin cannot appoint
 * another admin, and no one can promote themselves above their own role. */
export class CannotAssignRoleAboveOwnRankError extends GroupDomainError {
  constructor(groupId: string, callerKobaId: string, attemptedRole: CommunityRole) {
    super(
      `KOBAID "${callerKobaId}" cannot assign role "${attemptedRole}" in group "${groupId}" — it is not below their own role`,
    );
  }
}
