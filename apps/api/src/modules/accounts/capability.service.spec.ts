import { KobaIdRole } from '../kobaid/kobaid.types';
import { CapabilitiesNotDefinedForStaffRoleError } from './accounts.errors';
import { CapabilityService } from './capability.service';

describe('CapabilityService', () => {
  const service = new CapabilityService();

  it('grants Player marketplace/groups/cosmetic capabilities but no shop/dev/promo tools', () => {
    const flags = service.resolve(KobaIdRole.PLAYER);

    expect(flags.marketplaceBuy).toBe(true);
    expect(flags.marketplaceBid).toBe(true);
    expect(flags.groupsLfgDmsFeed).toBe(true);
    expect(flags.cosmeticInventory).toBe(true);

    expect(flags.shopTools).toBe(false);
    expect(flags.productUploads).toBe(false);
    expect(flags.adsCreation).toBe(false);
    expect(flags.devPortalAccess).toBe(false);
    expect(flags.promoPage).toBe(false);
    expect(flags.referralCodeManagement).toBe(false);
    expect(flags.earningsDashboard).toBe(false);

    expect(flags.adsPaused).toBe(true);
  });

  it('grants Business every Player capability plus shop tools/ads/dev portal', () => {
    const player = service.resolve(KobaIdRole.PLAYER);
    const business = service.resolve(KobaIdRole.BUSINESS);

    expect(business.marketplaceBuy).toBe(player.marketplaceBuy);
    expect(business.marketplaceBid).toBe(player.marketplaceBid);
    expect(business.groupsLfgDmsFeed).toBe(player.groupsLfgDmsFeed);
    expect(business.cosmeticInventory).toBe(player.cosmeticInventory);

    expect(business.shopTools).toBe(true);
    expect(business.productUploads).toBe(true);
    expect(business.adsCreation).toBe(true);
    expect(business.devPortalAccess).toBe(true);

    expect(business.adsPaused).toBe(false);
  });

  it('grants Influencer promo page/referral management/earnings dashboard only', () => {
    const flags = service.resolve(KobaIdRole.INFLUENCER);

    expect(flags.promoPage).toBe(true);
    expect(flags.referralCodeManagement).toBe(true);
    expect(flags.earningsDashboard).toBe(true);

    expect(flags.marketplaceBuy).toBe(false);
    expect(flags.shopTools).toBe(false);

    expect(flags.adsPaused).toBe(false);
  });

  it.each([KobaIdRole.SUPERADMIN, KobaIdRole.ADMIN, KobaIdRole.MODERATOR])(
    'throws for staff role %s (deferred to Phase 11 RBAC)',
    (role) => {
      expect(() => service.resolve(role)).toThrow(CapabilitiesNotDefinedForStaffRoleError);
    },
  );
});
