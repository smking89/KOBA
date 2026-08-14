/**
 * A community-level role attached to a normal Player/Business KOBAID
 * within a Group/Shop context — e.g. "Group Admin" or "Shop Moderator".
 * Deliberately a *separate* concept/enum from `KobaIdRole`'s staff roles
 * (SA/AD/MD, see kobaid.types.ts): ROADMAP.md's Phase 5/11 sections call
 * this distinction out explicitly as a hard requirement, not a nicety.
 *
 * This is intentionally the smallest possible shape to make badge
 * resolution (badge.resolver.ts) meaningful and testable — it is NOT
 * Phase 5's Groups module. No membership storage, no group CRUD, no
 * persistence here; just the enum a caller can pass in.
 */
export enum CommunityRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}
