import { KobaIdRole } from '../kobaid/kobaid.types';
import { resolveBadgeForKobaId } from './badge.resolver';
import { CommunityRole } from './community-role.types';

describe('resolveBadgeForKobaId', () => {
  it.each([KobaIdRole.SUPERADMIN, KobaIdRole.ADMIN, KobaIdRole.MODERATOR])(
    'never shows a badge for staff role %s, regardless of community role',
    (role) => {
      expect(resolveBadgeForKobaId({ role })).toEqual({ showBadge: false });
      expect(resolveBadgeForKobaId({ role }, CommunityRole.ADMIN)).toEqual({ showBadge: false });
      expect(resolveBadgeForKobaId({ role }, CommunityRole.MODERATOR)).toEqual({
        showBadge: false,
      });
      expect(resolveBadgeForKobaId({ role }, CommunityRole.OWNER)).toEqual({ showBadge: false });
    },
  );

  it('shows an admin badge for a community Admin', () => {
    expect(
      resolveBadgeForKobaId({ role: KobaIdRole.PLAYER }, CommunityRole.ADMIN),
    ).toEqual({ showBadge: true, badgeType: 'admin' });
  });

  it('shows a moderator badge for a community Moderator', () => {
    expect(
      resolveBadgeForKobaId({ role: KobaIdRole.BUSINESS }, CommunityRole.MODERATOR),
    ).toEqual({ showBadge: true, badgeType: 'moderator' });
  });

  it('shows no badge for a plain member with no community role', () => {
    expect(resolveBadgeForKobaId({ role: KobaIdRole.PLAYER })).toEqual({ showBadge: false });
    expect(
      resolveBadgeForKobaId({ role: KobaIdRole.PLAYER }, CommunityRole.MEMBER),
    ).toEqual({ showBadge: false });
  });

  it('applies equally across all community roles (PL/BZ/IN)', () => {
    for (const role of [KobaIdRole.PLAYER, KobaIdRole.BUSINESS, KobaIdRole.INFLUENCER]) {
      expect(resolveBadgeForKobaId({ role }, CommunityRole.ADMIN)).toEqual({
        showBadge: true,
        badgeType: 'admin',
      });
    }
  });
});
