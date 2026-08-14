import { LfgPost } from './lfg.types';

/**
 * Storage seam for LfgPosts, including the join ledger used to make
 * `LfgService#join()` reject a duplicate join by the same KOBAID.
 * Interface-behind-in-memory-implementation, same pattern as
 * `group.repository.ts`.
 */
export const LFG_POST_REPOSITORY = Symbol('LFG_POST_REPOSITORY');

export interface LfgPostRepository {
  findById(id: string): Promise<LfgPost | null>;
  save(post: LfgPost): Promise<LfgPost>;
  hasJoined(postId: string, kobaId: string): Promise<boolean>;
  /** Records that `kobaId` has joined `postId` — idempotent at the storage
   * layer, but `LfgService#join()` rejects a repeat call before this is
   * ever reached (see `AlreadyJoinedLfgPostError`). */
  recordJoin(postId: string, kobaId: string): Promise<void>;
}
