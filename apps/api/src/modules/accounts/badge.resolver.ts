import { isStaffRole, KobaId } from '../kobaid/kobaid.types';
import { BadgeResult } from './badge.types';
import { CommunityRole } from './community-role.types';

/**
 * Pure presentation function — no framework dependency, since apps/web
 * isn't bootstrapped yet. Decides whether a KOBAID should render a
 * badge/icon and, if so, which type.
 *
 * Rule (ROADMAP.md Phase 1/11): staff roles (SA/AD/MD) are identified
 * *only* by their KOBAID format code — they must never render a badge,
 * regardless of any community role also passed in. Community roles
 * (Group/Shop Admin/Moderator attached to a normal PL/BZ KOBAID — a
 * different concept, see community-role.types.ts) DO get a badge.
 */
export function resolveBadgeForKobaId(
  kobaId: Pick<KobaId, 'role'>,
  communityRole?: CommunityRole,
): BadgeResult {
  if (isStaffRole(kobaId.role)) {
    return { showBadge: false };
  }

  switch (communityRole) {
    case CommunityRole.ADMIN:
      return { showBadge: true, badgeType: 'admin' };
    case CommunityRole.MODERATOR:
      return { showBadge: true, badgeType: 'moderator' };
    // Group/shop Owner is treated as an "admin"-tier badge — ROADMAP.md's
    // Phase 5 outline doesn't define a distinct owner badge visual, and
    // owner is a superset of admin privileges community-side.
    case CommunityRole.OWNER:
      return { showBadge: true, badgeType: 'admin' };
    case CommunityRole.MEMBER:
    case undefined:
    default:
      return { showBadge: false };
  }
}
