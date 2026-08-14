import { Order } from './marketplace.types';

/** Storage seam for Orders — same interface-behind-in-memory pattern. */
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<Order>;
}
