/**
 * Storage seam for the Shop-follow relationship. Interface-behind-in-
 * memory-implementation, same pattern as every other repository in this
 * codebase. Follow is idempotent by construction here — `follow()` must
 * never create a second record for the same (shopId, followerKobaId)
 * pair, and `unfollow()` must never error when the pair doesn't exist.
 */
export const SHOP_FOLLOWER_REPOSITORY = Symbol('SHOP_FOLLOWER_REPOSITORY');

export interface ShopFollowerRepository {
  isFollowing(shopId: string, followerKobaId: string): Promise<boolean>;
  /** Idempotent — following twice must not create two records. */
  follow(shopId: string, followerKobaId: string): Promise<void>;
  /** Idempotent — unfollowing a shop you don't follow must not error. */
  unfollow(shopId: string, followerKobaId: string): Promise<void>;
  countByShop(shopId: string): Promise<number>;
}
