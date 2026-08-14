import { Injectable } from '@nestjs/common';
import { GroupMembershipRepository } from './group-membership.repository';
import { GroupMembership } from './group.types';

function key(groupId: string, memberKobaId: string): string {
  return `${groupId}:${memberKobaId}`;
}

@Injectable()
export class InMemoryGroupMembershipRepository implements GroupMembershipRepository {
  private readonly byKey = new Map<string, GroupMembership>();

  async find(groupId: string, memberKobaId: string): Promise<GroupMembership | null> {
    return this.byKey.get(key(groupId, memberKobaId)) ?? null;
  }

  async save(membership: GroupMembership): Promise<GroupMembership> {
    this.byKey.set(key(membership.groupId, membership.memberKobaId), membership);
    return membership;
  }

  async listByGroupId(groupId: string): Promise<GroupMembership[]> {
    return [...this.byKey.values()].filter((m) => m.groupId === groupId);
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byKey.clear();
  }
}
