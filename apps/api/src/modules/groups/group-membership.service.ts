import { Inject, Injectable } from '@nestjs/common';
import { KOBA_ID_PATTERN } from '../kobaid/kobaid-format';
import { KobaIdRole } from '../kobaid/kobaid.types';
import { resolveBadgeForKobaId } from '../accounts/badge.resolver';
import { CommunityRole } from '../accounts/community-role.types';
import {
  CannotAssignOwnerRoleError,
  CannotAssignRoleAboveOwnRankError,
  CannotModifyOwnerRoleError,
  InsufficientGroupRoleError,
  NotGroupMemberError,
  PrivateGroupJoinRequiresInviteError,
} from './group.errors';
import { GROUP_MEMBERSHIP_REPOSITORY, GroupMembershipRepository } from './group-membership.repository';
import { GroupService } from './group.service';
import { GroupMembership, GroupMemberWithBadge } from './group.types';

const MANAGER_ROLES: ReadonlySet<CommunityRole> = new Set([CommunityRole.OWNER, CommunityRole.ADMIN]);

/** Role hierarchy used to gate role assignment — owner > admin > moderator
 * > member. A caller can only assign a role strictly below their own rank
 * (see `setRole()`). */
const ROLE_RANK: Record<CommunityRole, number> = {
  [CommunityRole.OWNER]: 3,
  [CommunityRole.ADMIN]: 2,
  [CommunityRole.MODERATOR]: 1,
  [CommunityRole.MEMBER]: 0,
};

@Injectable()
export class GroupMembershipService {
  constructor(
    @Inject(GROUP_MEMBERSHIP_REPOSITORY) private readonly repository: GroupMembershipRepository,
    private readonly groupService: GroupService,
  ) {}

  async isMember(groupId: string, kobaId: string): Promise<boolean> {
    return (await this.repository.find(groupId, kobaId)) !== null;
  }

  async getMembership(groupId: string, kobaId: string): Promise<GroupMembership | null> {
    return this.repository.find(groupId, kobaId);
  }

  async listMembers(groupId: string): Promise<GroupMembership[]> {
    await this.groupService.getById(groupId);
    return this.repository.listByGroupId(groupId);
  }

  /**
   * A thin composition of `listMembers()` with
   * `accounts/badge.resolver.ts#resolveBadgeForKobaId()` for the Group Page
   * member list — reads the member's `KobaIdRole` structurally off their
   * KOBAID string (same posture as `shops/shop.service.ts`'s
   * `assertBusinessOwner()` — a plain KOBAID string, not a required-to-exist
   * foreign-key lookup this phase). No new cosmetic/badge modeling.
   */
  async listMembersWithBadges(groupId: string): Promise<GroupMemberWithBadge[]> {
    const members = await this.listMembers(groupId);
    return members.map((membership) => {
      const match = KOBA_ID_PATTERN.exec(membership.memberKobaId);
      const role = match ? (match[1] as KobaIdRole) : null;
      const badge = role ? resolveBadgeForKobaId({ role }, membership.role) : { showBadge: false as const };
      return { ...membership, badge };
    });
  }

  /**
   * Joining a public group is open to any KobaId. A private group cannot
   * be self-joined this phase — see `PrivateGroupJoinRequiresInviteError`'s
   * docstring and groups/README.md's TODO for a future invite/request-to-
   * join flow; an owner/admin must use `addMember()` instead. Idempotent —
   * joining twice returns the existing membership unchanged.
   */
  async join(groupId: string, kobaId: string): Promise<GroupMembership> {
    const group = await this.groupService.getById(groupId);
    if (group.visibility === 'private') {
      throw new PrivateGroupJoinRequiresInviteError(groupId);
    }

    const existing = await this.repository.find(groupId, kobaId);
    if (existing) {
      return existing;
    }

    return this.repository.save({
      groupId,
      memberKobaId: kobaId,
      role: CommunityRole.MEMBER,
      joinedAt: new Date(),
    });
  }

  /**
   * Owner/admin-only. Directly adds `targetKobaId` as a member (default
   * role `member`) — this is the only way to populate a private group's
   * membership this phase (see `join()`'s docstring). Idempotent — adding
   * an existing member returns their current membership unchanged.
   */
  async addMember(
    groupId: string,
    callerKobaId: string,
    targetKobaId: string,
    role: CommunityRole = CommunityRole.MEMBER,
  ): Promise<GroupMembership> {
    await this.groupService.getById(groupId);
    await this.assertCallerIsOwnerOrAdmin(groupId, callerKobaId);

    if (role === CommunityRole.OWNER) {
      throw new CannotAssignOwnerRoleError(groupId);
    }

    const existing = await this.repository.find(groupId, targetKobaId);
    if (existing) {
      return existing;
    }

    return this.repository.save({
      groupId,
      memberKobaId: targetKobaId,
      role,
      joinedAt: new Date(),
    });
  }

  /**
   * Promotes/demotes `targetKobaId`'s community role. Only the group's
   * owner/admin may call this (`InsufficientGroupRoleError` otherwise). The
   * owner's role can never be changed (`CannotModifyOwnerRoleError`), and
   * no one can be assigned the `owner` role (`CannotAssignOwnerRoleError`
   * — there is no ownership-transfer path this phase). A caller may only
   * assign a role strictly below their own rank — this is what prevents a
   * member from promoting themselves (or anyone else) above their current
   * role (`CannotAssignRoleAboveOwnRankError`).
   */
  async setRole(
    groupId: string,
    callerKobaId: string,
    targetKobaId: string,
    newRole: CommunityRole,
  ): Promise<GroupMembership> {
    await this.groupService.getById(groupId);

    const caller = await this.repository.find(groupId, callerKobaId);
    if (!caller || !MANAGER_ROLES.has(caller.role)) {
      throw new InsufficientGroupRoleError(groupId, callerKobaId);
    }

    const target = await this.repository.find(groupId, targetKobaId);
    if (!target) {
      throw new NotGroupMemberError(groupId, targetKobaId);
    }
    if (target.role === CommunityRole.OWNER) {
      throw new CannotModifyOwnerRoleError(groupId, targetKobaId);
    }
    if (newRole === CommunityRole.OWNER) {
      throw new CannotAssignOwnerRoleError(groupId);
    }
    if (ROLE_RANK[newRole] >= ROLE_RANK[caller.role]) {
      throw new CannotAssignRoleAboveOwnRankError(groupId, callerKobaId, newRole);
    }

    return this.repository.save({ ...target, role: newRole });
  }

  private async assertCallerIsOwnerOrAdmin(groupId: string, callerKobaId: string): Promise<void> {
    const caller = await this.repository.find(groupId, callerKobaId);
    if (!caller || !MANAGER_ROLES.has(caller.role)) {
      throw new InsufficientGroupRoleError(groupId, callerKobaId);
    }
  }
}
