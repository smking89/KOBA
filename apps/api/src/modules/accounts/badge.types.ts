/**
 * Typed result of badge resolution. `badgeType` only exists on the
 * showBadge:true variant, so callers can't accidentally read a badge type
 * off a KOBAID that shouldn't render one.
 */
export type BadgeResult =
  | { showBadge: false }
  | { showBadge: true; badgeType: 'admin' | 'moderator' };
