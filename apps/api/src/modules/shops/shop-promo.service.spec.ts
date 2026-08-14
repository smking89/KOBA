import { InMemoryShopRepository } from './in-memory-shop.repository';
import { InvalidPromoPayoutConfigError, ShopNotOwnedByCallerError } from './shop.errors';
import { ShopPromoService } from './shop-promo.service';
import { ShopService } from './shop.service';

describe('ShopPromoService', () => {
  let repository: InMemoryShopRepository;
  let shopService: ShopService;
  let service: ShopPromoService;

  const OWNER = 'KOBA-BZ-AAAA';

  beforeEach(() => {
    repository = new InMemoryShopRepository();
    shopService = new ShopService(repository);
    service = new ShopPromoService(shopService, repository);
  });

  async function createShop() {
    return shopService.createShop({ ownerKobaId: OWNER, name: 'Oxide Outfitters' });
  }

  it('sets a percent payout config', async () => {
    const shop = await createShop();

    const updated = await service.setPromoSettings(shop.id, OWNER, { promoEligible: true, percent: 12.5 });

    expect(updated.promoEligible).toBe(true);
    expect(updated.promoPayout).toEqual({ kind: 'percent', percent: 12.5 });
  });

  it('sets a fixed-cents payout config', async () => {
    const shop = await createShop();

    const updated = await service.setPromoSettings(shop.id, OWNER, { promoEligible: true, fixedCents: 500 });

    expect(updated.promoPayout).toEqual({ kind: 'fixed', fixedCents: 500 });
  });

  it('rejects both percent and fixedCents being set', async () => {
    const shop = await createShop();

    await expect(
      service.setPromoSettings(shop.id, OWNER, { promoEligible: true, percent: 10, fixedCents: 500 }),
    ).rejects.toThrow(InvalidPromoPayoutConfigError);
  });

  it('rejects neither percent nor fixedCents being set', async () => {
    const shop = await createShop();

    await expect(
      service.setPromoSettings(shop.id, OWNER, { promoEligible: true }),
    ).rejects.toThrow(InvalidPromoPayoutConfigError);
  });

  it('rejects an out-of-range percent', async () => {
    const shop = await createShop();

    await expect(
      service.setPromoSettings(shop.id, OWNER, { promoEligible: true, percent: 150 }),
    ).rejects.toThrow(InvalidPromoPayoutConfigError);
  });

  it('rejects a negative fixedCents', async () => {
    const shop = await createShop();

    await expect(
      service.setPromoSettings(shop.id, OWNER, { promoEligible: true, fixedCents: -1 }),
    ).rejects.toThrow(InvalidPromoPayoutConfigError);
  });

  it('only the owner may set promo settings', async () => {
    const shop = await createShop();

    await expect(
      service.setPromoSettings(shop.id, 'KOBA-BZ-ZZZZ', { promoEligible: true, percent: 10 }),
    ).rejects.toThrow(ShopNotOwnedByCallerError);
  });

  it('getPromoSettings reflects the last write', async () => {
    const shop = await createShop();
    await service.setPromoSettings(shop.id, OWNER, { promoEligible: true, fixedCents: 250 });

    const settings = await service.getPromoSettings(shop.id);

    expect(settings).toEqual({ promoEligible: true, payout: { kind: 'fixed', fixedCents: 250 } });
  });

  it('defaults to promoEligible false and null payout before any config is set', async () => {
    const shop = await createShop();

    const settings = await service.getPromoSettings(shop.id);

    expect(settings).toEqual({ promoEligible: false, payout: null });
  });
});
