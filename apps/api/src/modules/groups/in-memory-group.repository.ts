import { Injectable } from '@nestjs/common';
import { GroupRepository } from './group.repository';
import { Group } from './group.types';

@Injectable()
export class InMemoryGroupRepository implements GroupRepository {
  private readonly byId = new Map<string, Group>();

  async findById(id: string): Promise<Group | null> {
    return this.byId.get(id) ?? null;
  }

  async save(group: Group): Promise<Group> {
    this.byId.set(group.id, group);
    return group;
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byId.clear();
  }
}
