import { Group } from './group.types';

/**
 * Storage seam for Groups. Interface-behind-in-memory-implementation, same
 * pattern as `shops/shop.repository.ts` — see groups/README.md for why
 * this phase ships an in-memory implementation instead of wiring
 * Prisma/Postgres.
 */
export const GROUP_REPOSITORY = Symbol('GROUP_REPOSITORY');

export interface GroupRepository {
  findById(id: string): Promise<Group | null>;
  save(group: Group): Promise<Group>;
}
