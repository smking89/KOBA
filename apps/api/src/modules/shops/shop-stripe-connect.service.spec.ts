import { InMemorySellerVerificationRepository } from '../marketplace/in-memory-seller-verification.repository';
import { InMemoryStripeAccountRepository } from '../marketplace/in-memory-stripe-account.repository';
import { StripeConnectService } from '../marketplace/stripe-connect.service';
import { StripeAccountStatus } from '../marketplace/stripe-connect.types';
import { InMemoryShopRepository } from './in-memory-shop.repository';
import { InvalidShopStripeStatusTransitionError, ShopNotOwnedByCallerError } from './shop.errors';
import { ShopService } from './shop.service';
import { ShopStripeConnectService } from './shop-stripe-connect.service';

describe('ShopStripeConnectService', () => {
  let shopService: ShopService;
  let stripeConnectService: StripeConnectService;
  let service: ShopStripeConnectService;

  const OWNER = 'KOBA-BZ-AAAA';

  beforeEach(() => {
    const shopRepository = new InMemoryShopRepository();
    const stripeAccountRepository = new InMemoryStripeAccountRepository();
    const sellerVerificationRepository = new InMemorySellerVerificationRepository();

    shopService = new ShopService(shopRepository);
    stripeConnectService = new StripeConnectService(
      stripeAccountRepository,
      { standardRate: 0.08, verifiedRate: 0.04 },
      sellerVerificationRepository,
    );
    service = new ShopStripeConnectService(shopService, stripeConnectService);
  });

  async function createShop() {
    return shopService.createShop({ ownerKobaId: OWNER, name: 'Oxide Outfitters' });
  }

  it('starts notConnected', async () => {
    const shop = await createShop();
    expect(await service.getStatus(shop.id)).toBe(StripeAccountStatus.NOT_CONNECTED);
  });

  it('transitions notConnected -> pending -> active', async () => {
    const shop = await createShop();

    const pending = await service.initiateConnection(shop.id, OWNER);
    expect(pending).toBe(StripeAccountStatus.PENDING);
    expect(await service.getStatus(shop.id)).toBe(StripeAccountStatus.PENDING);

    const active = await service.confirmConnection(shop.id, OWNER);
    expect(active).toBe(StripeAccountStatus.ACTIVE);
    expect(await service.getStatus(shop.id)).toBe(StripeAccountStatus.ACTIVE);
  });

  it('rejects confirmConnection before initiateConnection', async () => {
    const shop = await createShop();

    await expect(service.confirmConnection(shop.id, OWNER)).rejects.toThrow(
      InvalidShopStripeStatusTransitionError,
    );
  });

  it('rejects initiating a connection twice', async () => {
    const shop = await createShop();
    await service.initiateConnection(shop.id, OWNER);

    await expect(service.initiateConnection(shop.id, OWNER)).rejects.toThrow(
      InvalidShopStripeStatusTransitionError,
    );
  });

  it('rejects confirming an already-active connection', async () => {
    const shop = await createShop();
    await service.initiateConnection(shop.id, OWNER);
    await service.confirmConnection(shop.id, OWNER);

    await expect(service.confirmConnection(shop.id, OWNER)).rejects.toThrow(
      InvalidShopStripeStatusTransitionError,
    );
  });

  it('only the owner may initiate/confirm the connection', async () => {
    const shop = await createShop();

    await expect(service.initiateConnection(shop.id, 'KOBA-BZ-ZZZZ')).rejects.toThrow(
      ShopNotOwnedByCallerError,
    );

    await service.initiateConnection(shop.id, OWNER);
    await expect(service.confirmConnection(shop.id, 'KOBA-BZ-ZZZZ')).rejects.toThrow(
      ShopNotOwnedByCallerError,
    );
  });
});
