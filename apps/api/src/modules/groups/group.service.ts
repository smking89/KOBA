import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CommunityRole } from '../accounts/community-role.types';
import { GroupNotFoundError, InsufficientGroupRoleError } from './group.errors';
import { GROUP_MEMBERSHIP_REPOSITORY, GroupMembershipRepository } from './group-membership.repository';
import { GROUP_REPOSITORY, GroupRepository } from './group.repository';
import { CreateGroupParams, Group } from './group.types';

const MANAGER_ROLES: ReadonlySet<CommunityRole> = new Set([CommunityRole.OWNER, CommunityRole.ADMIN]);

@Injectable()
export class GroupService {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly repository: GroupRepository,
    @Inject(GROUP_MEMBERSHIP_REPOSITORY) private readonly membershipRepository: GroupMembershipRepository,
  ) {}

  /**
   * Creates a Group. `ownerKobaId` is set once and never mutated anywhere
   * in this module (same "immutable owner" posture as
   * `shops/shop.service.ts#createShop()`). The owner is auto-assigned the
   * `owner` `CommunityRole` via a `GroupMembership` row created in the same
   * call — see `group-membership.repository.ts`.
   */
  async createGroup(params: CreateGroupParams): Promise<Group> {
    const group: Group = {
      id: randomUUID(),
      name: params.name,
      visibility: params.visibility,
      ownerKobaId: params.ownerKobaId,
      allowTagging: true,
      createdAt: new Date(),
    };

    await this.repository.save(group);
    await this.membershipRepository.save({
      groupId: group.id,
      memberKobaId: params.ownerKobaId,
      role: CommunityRole.OWNER,
      joinedAt: new Date(),
    });

    return group;
  }

  async findById(id: string): Promise<Group | null> {
    return this.repository.findById(id);
  }

  async getById(id: string): Promise<Group> {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new GroupNotFoundError(id);
    }
    return group;
  }

  /**
   * Owner/admin-controlled tag-permission flag — Phase 6's group-level
   * analogue to `shops/shop.service.ts#setAllowTagging()`. No enforcement
   * of this flag anywhere yet; that's Phase 6.
   */
  async setAllowTagging(groupId: string, callerKobaId: string, allowTagging: boolean): Promise<Group> {
    const group = await this.getById(groupId);
    await this.assertCallerIsOwnerOrAdmin(groupId, callerKobaId);

    if (group.allowTagging === allowTagging) {
      return group;
    }
    return this.repository.save({ ...group, allowTagging });
  }

  async isTaggingAllowed(groupId: string): Promise<boolean> {
    return (await this.getById(groupId)).allowTagging;
  }

  private async assertCallerIsOwnerOrAdmin(groupId: string, callerKobaId: string): Promise<void> {
    const caller = await this.membershipRepository.find(groupId, callerKobaId);
    if (!caller || !MANAGER_ROLES.has(caller.role)) {
      throw new InsufficientGroupRoleError(groupId, callerKobaId);
    }
  }
}
