import { KobaIdRole } from '../kobaid/kobaid.types';
import { TaggingPermissionsNotDefinedForStaffRoleError } from './accounts.errors';
import { TaggingPermissionService } from './tagging-permission.service';

describe('TaggingPermissionService', () => {
  const service = new TaggingPermissionService();

  it('grants Player normal social tagging but no shop/promo tagging', () => {
    const permissions = service.resolve(KobaIdRole.PLAYER);

    expect(permissions.canTagAsPlayer).toBe(true);
    expect(permissions.canTagShopProducts).toBe(false);
    expect(permissions.canTagPromo).toBe(false);
  });

  it('grants Business every Player tagging permission plus shop/product tagging', () => {
    const player = service.resolve(KobaIdRole.PLAYER);
    const business = service.resolve(KobaIdRole.BUSINESS);

    expect(business.canTagAsPlayer).toBe(player.canTagAsPlayer);
    expect(business.canTagShopProducts).toBe(true);
    expect(business.canTagPromo).toBe(false);
  });

  it('grants Influencer every Player tagging permission plus promo/referral tagging', () => {
    const player = service.resolve(KobaIdRole.PLAYER);
    const influencer = service.resolve(KobaIdRole.INFLUENCER);

    expect(influencer.canTagAsPlayer).toBe(player.canTagAsPlayer);
    expect(influencer.canTagShopProducts).toBe(false);
    expect(influencer.canTagPromo).toBe(true);
  });

  it('switching to Player mode disables business/influencer tagging capabilities', () => {
    const player = service.resolve(KobaIdRole.PLAYER);

    expect(player.canTagShopProducts).toBe(false);
    expect(player.canTagPromo).toBe(false);
  });

  it.each([KobaIdRole.SUPERADMIN, KobaIdRole.ADMIN, KobaIdRole.MODERATOR])(
    'throws for staff role %s (not part of the Player/Business/Influencer model)',
    (role) => {
      expect(() => service.resolve(role)).toThrow(
        TaggingPermissionsNotDefinedForStaffRoleError,
      );
    },
  );
});
