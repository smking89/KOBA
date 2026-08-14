import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  AlreadyJoinedLfgPostError,
  InvalidMaxSlotsError,
  LfgPostExpiredError,
  LfgPostFullError,
  LfgPostNotFoundError,
} from './lfg.errors';
import { LFG_POST_REPOSITORY, LfgPostRepository } from './lfg.repository';
import { CreateLfgPostParams, LfgPost } from './lfg.types';

@Injectable()
export class LfgService {
  constructor(@Inject(LFG_POST_REPOSITORY) private readonly repository: LfgPostRepository) {}

  /** `groupId` is optional/nullable — a standalone LFG post (no groupId)
   * is a first-class case, per the Phase 0 design's standalone LFG Page. */
  async createLfgPost(params: CreateLfgPostParams): Promise<LfgPost> {
    if (!Number.isInteger(params.maxSlots) || params.maxSlots <= 0) {
      throw new InvalidMaxSlotsError(params.maxSlots);
    }

    const post: LfgPost = {
      id: randomUUID(),
      authorKobaId: params.authorKobaId,
      groupId: params.groupId ?? null,
      game: params.game,
      mode: params.mode,
      requirementsText: params.requirementsText,
      maxSlots: params.maxSlots,
      filledSlots: 0,
      expiresAt: params.expiresAt,
      createdAt: new Date(),
    };

    return this.repository.save(post);
  }

  async getById(postId: string): Promise<LfgPost> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new LfgPostNotFoundError(postId);
    }
    return post;
  }

  /** No background scheduler in this pass — this just checks the clock,
   * same posture as `marketplace/auction.service.ts#hasEnded()`. `now` is
   * injectable for tests that need to assert expiry at multiple points in
   * time without depending on the real clock. */
  isExpired(post: LfgPost, now: Date = new Date()): boolean {
    return post.expiresAt.getTime() < now.getTime();
  }

  /**
   * Increments `filledSlots` for `kobaId` joining `postId`. Typed errors:
   * `LfgPostExpiredError` (expiresAt already passed), `LfgPostFullError`
   * (filledSlots already at maxSlots), `AlreadyJoinedLfgPostError` (same
   * kobaId joining a second time — a slot is never double-counted for one
   * person).
   */
  async joinLfgPost(postId: string, kobaId: string): Promise<LfgPost> {
    const post = await this.getById(postId);

    if (this.isExpired(post)) {
      throw new LfgPostExpiredError(postId);
    }
    if (await this.repository.hasJoined(postId, kobaId)) {
      throw new AlreadyJoinedLfgPostError(postId, kobaId);
    }
    if (post.filledSlots >= post.maxSlots) {
      throw new LfgPostFullError(postId);
    }

    await this.repository.recordJoin(postId, kobaId);
    return this.repository.save({ ...post, filledSlots: post.filledSlots + 1 });
  }
}
