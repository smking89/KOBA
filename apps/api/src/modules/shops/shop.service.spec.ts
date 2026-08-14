import { InMemoryShopRepository } from './in-memory-shop.repository';
import {
  InvalidShopOwnerKobaIdFormatError,
  ShopNotFoundError,
  ShopNotOwnedByCallerError,
  ShopOwnerMustBeBusinessRoleError,
} from './shop.errors';
import { ShopService } from './shop.service';

describe('ShopService', () => {
  let repository: InMemoryShopRepository;
  let service: ShopService;

  const BUSINESS_OWNER = 'KOBA-BZ-AAAA';

  beforeEach(() => {
    repository = new InMemoryShopRepository();
    service = new ShopService(repository);
  });

  describe('createShop', () => {
    it('creates a shop for a Business-role owner', async () => {
      const shop = await service.createShop({ ownerKobaId: BUSINESS_OWNER, name: 'Oxide Outfitters' });

      expect(shop.id).toBeDefined();
      expect(shop.ownerKobaId).toBe(BUSINESS_OWNER);
      expect(shop.name).toBe('Oxide Outfitters');
      expect(shop.bio).toBe('');
      expect(shop.bannerUrl).toBeNull();
      expect(shop.avatarUrl).toBeNull();
      expect(shop.allowTagging).toBe(true);
      expect(shop.promoEligible).toBe(false);
      expect(shop.promoPayout).toBeNull();
      expect(shop.createdAt).toBeInstanceOf(Date);
    });

    it('rejects a Player-owned shop', async () => {
      await expect(
        service.createShop({ ownerKobaId: 'KOBA-PL-BBBB', name: 'Nope' }),
      ).rejects.toThrow(ShopOwnerMustBeBusinessRoleError);
    });

    it('rejects an Influencer-owned shop', async () => {
      await expect(
        service.createShop({ ownerKobaId: 'KOBA-IN-CCCC', name: 'Nope' }),
      ).rejects.toThrow(ShopOwnerMustBeBusinessRoleError);
    });

    it('rejects a malformed ownerKobaId', async () => {
      await expect(
        service.createShop({ ownerKobaId: 'not-a-kobaid', name: 'Nope' }),
      ).rejects.toThrow(InvalidShopOwnerKobaIdFormatError);
    });
  });

  describe('getById / findById', () => {
    it('throws ShopNotFoundError for an unknown id', async () => {
      await expect(service.getById('does-not-exist')).rejects.toThrow(ShopNotFoundError);
    });

    it('findById returns null for an unknown id', async () => {
      expect(await service.findById('does-not-exist')).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('updates name/bio/banner/avatar but leaves ownerKobaId/id/createdAt untouched', async () => {
      const shop = await service.createShop({ ownerKobaId: BUSINESS_OWNER, name: 'Oxide Outfitters' });

      const updated = await service.updateProfile(shop.id, BUSINESS_OWNER, {
        name: 'Oxide Outfitters Co.',
        bio: 'Best monument kits in Rust',
        bannerUrl: 'https://example.com/banner.png',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(updated.id).toBe(shop.id);
      expect(updated.ownerKobaId).toBe(shop.ownerKobaId);
      expect(updated.createdAt).toEqual(shop.createdAt);
      expect(updated.name).toBe('Oxide Outfitters Co.');
      expect(updated.bio).toBe('Best monument kits in Rust');
      expect(updated.bannerUrl).toBe('https://example.com/banner.png');
      expect(updated.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('leaves unspecified fields unchanged on a partial update', async () => {
      const shop = await service.createShop({
        ownerKobaId: BUSINESS_OWNER,
        name: 'Oxide Outfitters',
        bio: 'original bio',
      });

      const updated = await service.updateProfile(shop.id, BUSINESS_OWNER, { name: 'New Name' });

      expect(updated.name).toBe('New Name');
      expect(updated.bio).toBe('original bio');
    });

    it('only the owner may update the profile', async () => {
      const shop = await service.createShop({ ownerKobaId: BUSINESS_OWNER, name: 'Oxide Outfitters' });

      await expect(
        service.updateProfile(shop.id, 'KOBA-BZ-ZZZZ', { name: 'Hijacked' }),
      ).rejects.toThrow(ShopNotOwnedByCallerError);
    });
  });

  describe('allowTagging', () => {
    it('defaults to true and can be toggled by the owner', async () => {
      const shop = await service.createShop({ ownerKobaId: BUSINESS_OWNER, name: 'Oxide Outfitters' });
      expect(await service.isTaggingAllowed(shop.id)).toBe(true);

      const updated = await service.setAllowTagging(shop.id, BUSINESS_OWNER, false);
      expect(updated.allowTagging).toBe(false);
      expect(await service.isTaggingAllowed(shop.id)).toBe(false);

      const reEnabled = await service.setAllowTagging(shop.id, BUSINESS_OWNER, true);
      expect(reEnabled.allowTagging).toBe(true);
    });

    it('only the owner may toggle allowTagging', async () => {
      const shop = await service.createShop({ ownerKobaId: BUSINESS_OWNER, name: 'Oxide Outfitters' });

      await expect(
        service.setAllowTagging(shop.id, 'KOBA-BZ-ZZZZ', false),
      ).rejects.toThrow(ShopNotOwnedByCallerError);
    });
  });
});
