import { Injectable } from '@nestjs/common';
import { ShopFollowerRepository } from './shop-follower.repository';

@Injectable()
export class InMemoryShopFollowerRepository implements ShopFollowerRepository {
  private readonly followersByShop = new Map<string, Set<string>>();

  async isFollowing(shopId: string, followerKobaId: string): Promise<boolean> {
    return this.followersByShop.get(shopId)?.has(followerKobaId) ?? false;
  }

  async follow(shopId: string, followerKobaId: string): Promise<void> {
    const followers = this.followersByShop.get(shopId) ?? new Set<string>();
    followers.add(followerKobaId);
    this.followersByShop.set(shopId, followers);
  }

  async unfollow(shopId: string, followerKobaId: string): Promise<void> {
    this.followersByShop.get(shopId)?.delete(followerKobaId);
  }

  async countByShop(shopId: string): Promise<number> {
    return this.followersByShop.get(shopId)?.size ?? 0;
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.followersByShop.clear();
  }
}
