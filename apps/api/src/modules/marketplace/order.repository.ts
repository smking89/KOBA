import { Order } from './marketplace.types';

/** Storage seam for Orders — same interface-behind-in-memory pattern. */
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<Order>;
  /**
   * Additive (Phase 4/Shops) — all settled Orders for a given seller
   * KOBAID. Every `Order` in this module already represents a completed/
   * settled purchase (there is no separate pending/settled status field —
   * see marketplace/README.md), so this is simply every Order row keyed
   * by `sellerKobaId`.
   */
  findBySellerKobaId(sellerKobaId: string): Promise<Order[]>;
}
