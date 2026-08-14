import { Injectable } from '@nestjs/common';
import { ProductRepository } from './product.repository';
import { Product } from './marketplace.types';

@Injectable()
export class InMemoryProductRepository implements ProductRepository {
  private readonly byId = new Map<string, Product>();

  async findById(id: string): Promise<Product | null> {
    return this.byId.get(id) ?? null;
  }

  async save(product: Product): Promise<Product> {
    this.byId.set(product.id, product);
    return product;
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byId.clear();
  }
}
