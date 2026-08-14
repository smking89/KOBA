import { Injectable } from '@nestjs/common';
import { GroupPostRepository } from './group-post.repository';
import { GroupPost } from './group.types';

@Injectable()
export class InMemoryGroupPostRepository implements GroupPostRepository {
  private readonly posts: GroupPost[] = [];

  async save(post: GroupPost): Promise<GroupPost> {
    this.posts.push(post);
    return post;
  }

  async listByGroupId(groupId: string): Promise<GroupPost[]> {
    return this.posts.filter((p) => p.groupId === groupId);
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.posts.length = 0;
  }
}
