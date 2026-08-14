import { Product } from './marketplace.types';

/**
 * Storage seam for Products. Interface-behind-in-memory-implementation,
 * same pattern as kobaid/kobaid.repository.ts — no real Postgres wiring
 * this phase (see marketplace/README.md).
 */
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<Product>;
}
