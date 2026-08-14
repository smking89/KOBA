import { CommunityRole } from '../accounts/community-role.types';
import { BadgeResult } from '../accounts/badge.types';

export type GroupVisibility = 'public' | 'private';

/**
 * A Group. `id`/`ownerKobaId`/`createdAt` are immutable once created — same
 * "no update path for identity-defining fields" pattern as `shops/shop.types.ts`'s
 * `Shop`. `visibility`/`allowTagging` are the only mutable fields, both
 * owner/admin-controlled (see `group.service.ts`).
 */
export interface Group {
  readonly id: string;
  readonly name: string;
  readonly visibility: GroupVisibility;
  /** Immutable once set — see `GroupService#createGroup()`. */
  readonly ownerKobaId: string;
  /** Owner/admin-controlled, defaults to `true` — same shape as
   * `shops/shop.types.ts`'s `Shop.allowTagging`. Config only, no
   * enforcement here; real tag enforcement is Phase 6. */
  readonly allowTagging: boolean;
  readonly createdAt: Date;
}

export interface CreateGroupParams {
  name: string;
  visibility: GroupVisibility;
  ownerKobaId: string;
}

/**
 * Join row between a Group and a member KOBAID, carrying the member's
 * community role within that group. Reuses `accounts/community-role.types.ts`'s
 * `CommunityRole` — deliberately NOT redefined here (ROADMAP.md Phase 5
 * calls out community vs. staff role separation as a hard requirement, and
 * `CommunityRole` already exists for exactly this purpose).
 */
export interface GroupMembership {
  readonly groupId: string;
  readonly memberKobaId: string;
  readonly role: CommunityRole;
  readonly joinedAt: Date;
}

/**
 * A `GroupMembership` composed with the badge-resolution result
 * (`accounts/badge.resolver.ts#resolveBadgeForKobaId()`) for that member —
 * a thin read-model for the Group Page member list (Phase 0 design's
 * Owner/Admin/Moderator/Member badge icons). No new cosmetic/badge
 * modeling — just composition of what `accounts/` already provides.
 */
export interface GroupMemberWithBadge extends GroupMembership {
  readonly badge: BadgeResult;
}

/**
 * A lightweight text post scoped to a Group's feed. NOT Phase 6's full
 * social layer (no likes/comments/shares/tagging enforcement) — just
 * enough to exist and be queryable (ROADMAP.md Phase 5's "build the group
 * feed's data shape now, wire it into the ranked feed later").
 */
export interface GroupPost {
  readonly id: string;
  readonly groupId: string;
  readonly authorKobaId: string;
  readonly text: string;
  readonly createdAt: Date;
}

export interface CreateGroupPostParams {
  groupId: string;
  authorKobaId: string;
  text: string;
}
