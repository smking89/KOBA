import { Injectable } from '@nestjs/common';
import { LfgPostRepository } from './lfg.repository';
import { LfgPost } from './lfg.types';

@Injectable()
export class InMemoryLfgPostRepository implements LfgPostRepository {
  private readonly byId = new Map<string, LfgPost>();
  private readonly joinsByPostId = new Map<string, Set<string>>();

  async findById(id: string): Promise<LfgPost | null> {
    return this.byId.get(id) ?? null;
  }

  async save(post: LfgPost): Promise<LfgPost> {
    this.byId.set(post.id, post);
    return post;
  }

  async hasJoined(postId: string, kobaId: string): Promise<boolean> {
    return this.joinsByPostId.get(postId)?.has(kobaId) ?? false;
  }

  async recordJoin(postId: string, kobaId: string): Promise<void> {
    const joined = this.joinsByPostId.get(postId) ?? new Set<string>();
    joined.add(kobaId);
    this.joinsByPostId.set(postId, joined);
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byId.clear();
    this.joinsByPostId.clear();
  }
}
