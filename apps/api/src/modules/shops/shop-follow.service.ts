import { Inject, Injectable } from '@nestjs/common';
import { SHOP_FOLLOWER_REPOSITORY, ShopFollowerRepository } from './shop-follower.repository';
import { ShopService } from './shop.service';

/**
 * Shop-follow relationship — ROADMAP.md Phase 4's followers deliverable.
 * A KOBAID can follow a shop once; following twice is idempotent (no
 * duplicate record, no error), unfollowing removes it (idempotent too —
 * unfollowing a shop you don't follow is a no-op). Follower count feeds
 * `ShopAnalyticsService`.
 */
@Injectable()
export class ShopFollowService {
  constructor(
    private readonly shopService: ShopService,
    @Inject(SHOP_FOLLOWER_REPOSITORY) private readonly repository: ShopFollowerRepository,
  ) {}

  async follow(shopId: string, followerKobaId: string): Promise<void> {
    await this.shopService.getById(shopId); // throws ShopNotFoundError if shopId is unknown
    await this.repository.follow(shopId, followerKobaId);
  }

  async unfollow(shopId: string, followerKobaId: string): Promise<void> {
    await this.repository.unfollow(shopId, followerKobaId);
  }

  async isFollowing(shopId: string, followerKobaId: string): Promise<boolean> {
    return this.repository.isFollowing(shopId, followerKobaId);
  }

  async countFollowers(shopId: string): Promise<number> {
    return this.repository.countByShop(shopId);
  }
}
