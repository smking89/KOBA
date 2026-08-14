import { Injectable } from '@nestjs/common';
import { ShopRepository } from './shop.repository';
import { Shop } from './shop.types';

@Injectable()
export class InMemoryShopRepository implements ShopRepository {
  private readonly byId = new Map<string, Shop>();

  async findById(id: string): Promise<Shop | null> {
    return this.byId.get(id) ?? null;
  }

  async save(shop: Shop): Promise<Shop> {
    this.byId.set(shop.id, shop);
    return shop;
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byId.clear();
  }
}
