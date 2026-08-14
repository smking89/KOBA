import { GroupMembership } from './group.types';

/**
 * Storage seam for GroupMemberships. Interface-behind-in-memory-implementation,
 * same pattern as `group.repository.ts` / `shops/shop-follower.repository.ts`.
 */
export const GROUP_MEMBERSHIP_REPOSITORY = Symbol('GROUP_MEMBERSHIP_REPOSITORY');

export interface GroupMembershipRepository {
  find(groupId: string, memberKobaId: string): Promise<GroupMembership | null>;
  save(membership: GroupMembership): Promise<GroupMembership>;
  listByGroupId(groupId: string): Promise<GroupMembership[]>;
}
