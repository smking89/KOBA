import { Shop } from './shop.types';

/**
 * Storage seam for Shops. Interface-behind-in-memory-implementation, same
 * pattern as `kobaid/kobaid.repository.ts` / `marketplace/product.repository.ts`
 * — see shops/README.md for why this phase ships an in-memory implementation
 * instead of wiring Prisma/Postgres.
 */
export const SHOP_REPOSITORY = Symbol('SHOP_REPOSITORY');

export interface ShopRepository {
  findById(id: string): Promise<Shop | null>;
  save(shop: Shop): Promise<Shop>;
}
