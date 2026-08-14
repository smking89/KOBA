import { InMemoryShopFollowerRepository } from './in-memory-shop-follower.repository';
import { InMemoryShopRepository } from './in-memory-shop.repository';
import { ShopFollowService } from './shop-follow.service';
import { ShopNotFoundError } from './shop.errors';
import { ShopService } from './shop.service';

describe('ShopFollowService', () => {
  let shopRepository: InMemoryShopRepository;
  let followerRepository: InMemoryShopFollowerRepository;
  let shopService: ShopService;
  let service: ShopFollowService;

  const OWNER = 'KOBA-BZ-AAAA';
  const FOLLOWER = 'KOBA-PL-BBBB';

  beforeEach(() => {
    shopRepository = new InMemoryShopRepository();
    followerRepository = new InMemoryShopFollowerRepository();
    shopService = new ShopService(shopRepository);
    service = new ShopFollowService(shopService, followerRepository);
  });

  async function createShop() {
    return shopService.createShop({ ownerKobaId: OWNER, name: 'Oxide Outfitters' });
  }

  it('throws for an unknown shop', async () => {
    await expect(service.follow('does-not-exist', FOLLOWER)).rejects.toThrow(ShopNotFoundError);
  });

  it('follows a shop and reports it as followed', async () => {
    const shop = await createShop();

    await service.follow(shop.id, FOLLOWER);

    expect(await service.isFollowing(shop.id, FOLLOWER)).toBe(true);
    expect(await service.countFollowers(shop.id)).toBe(1);
  });

  it('following twice is idempotent (no duplicate record, count stays 1)', async () => {
    const shop = await createShop();

    await service.follow(shop.id, FOLLOWER);
    await service.follow(shop.id, FOLLOWER);

    expect(await service.countFollowers(shop.id)).toBe(1);
  });

  it('unfollowing removes the follow relationship', async () => {
    const shop = await createShop();
    await service.follow(shop.id, FOLLOWER);

    await service.unfollow(shop.id, FOLLOWER);

    expect(await service.isFollowing(shop.id, FOLLOWER)).toBe(false);
    expect(await service.countFollowers(shop.id)).toBe(0);
  });

  it('unfollowing a shop you do not follow is a no-op, not an error', async () => {
    const shop = await createShop();

    await expect(service.unfollow(shop.id, FOLLOWER)).resolves.toBeUndefined();
    expect(await service.countFollowers(shop.id)).toBe(0);
  });

  it('counts multiple distinct followers', async () => {
    const shop = await createShop();

    await service.follow(shop.id, FOLLOWER);
    await service.follow(shop.id, 'KOBA-PL-CCCC');

    expect(await service.countFollowers(shop.id)).toBe(2);
  });
});
