import { Injectable } from '@nestjs/common';
import { OrderRepository } from './order.repository';
import { Order } from './marketplace.types';

@Injectable()
export class InMemoryOrderRepository implements OrderRepository {
  private readonly byId = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.byId.get(id) ?? null;
  }

  async save(order: Order): Promise<Order> {
    this.byId.set(order.id, order);
    return order;
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byId.clear();
  }
}
