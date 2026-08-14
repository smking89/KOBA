import { GroupPost } from './group.types';

/**
 * Storage seam for GroupPosts (the group feed). Interface-behind-in-memory-
 * implementation, same pattern as `group.repository.ts`.
 */
export const GROUP_POST_REPOSITORY = Symbol('GROUP_POST_REPOSITORY');

export interface GroupPostRepository {
  save(post: GroupPost): Promise<GroupPost>;
  listByGroupId(groupId: string): Promise<GroupPost[]>;
}
