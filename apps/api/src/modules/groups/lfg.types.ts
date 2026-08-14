/**
 * A Looking-For-Group post. `groupId` is nullable — an LFG post can be
 * independent of any Group, per the Phase 0 design's standalone LFG Page.
 * `expiresAt`/`filledSlots` are read against the clock at query time
 * (`LfgService#isExpired()`); there is no separate mutable `status` field
 * that could drift from the clock — same posture as
 * `marketplace/auction.service.ts#hasEnded()`.
 */
export interface LfgPost {
  readonly id: string;
  readonly authorKobaId: string;
  readonly groupId: string | null;
  readonly game: string;
  readonly mode: string;
  readonly requirementsText: string;
  readonly maxSlots: number;
  readonly filledSlots: number;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface CreateLfgPostParams {
  authorKobaId: string;
  groupId?: string | null;
  game: string;
  mode: string;
  requirementsText: string;
  maxSlots: number;
  expiresAt: Date;
}
