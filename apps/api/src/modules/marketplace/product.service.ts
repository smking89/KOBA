import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  CosmeticTypeNotAllowedError,
  CosmeticTypeRequiredError,
  InvalidCosmeticTypeError,
  InvalidMoneyAmountError,
  InvalidProductCategoryError,
  InvalidRarityTierError,
  ProductNotFoundError,
  ProductNotOwnedByCallerError,
  UnsupportedGameError,
} from './marketplace.errors';
import {
  COSMETIC_TYPES,
  CreateProductParams,
  PRODUCT_CATEGORIES,
  Product,
  ProductCategory,
  RARITY_TIERS,
  SUPPORTED_GAMES,
} from './marketplace.types';
import { PRODUCT_REPOSITORY, ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repository: ProductRepository) {}

  async createProduct(params: CreateProductParams): Promise<Product> {
    if (!SUPPORTED_GAMES.includes(params.game)) {
      throw new UnsupportedGameError(params.game);
    }
    if (!(PRODUCT_CATEGORIES as string[]).includes(params.category)) {
      throw new InvalidProductCategoryError(params.category);
    }
    if (!(RARITY_TIERS as string[]).includes(params.rarity)) {
      throw new InvalidRarityTierError(params.rarity);
    }
    if (!Number.isInteger(params.priceCents) || params.priceCents < 0) {
      throw new InvalidMoneyAmountError('priceCents', params.priceCents);
    }

    const cosmeticType = params.cosmeticType ?? null;
    if (params.category === ProductCategory.COSMETIC) {
      if (cosmeticType === null) {
        throw new CosmeticTypeRequiredError();
      }
      if (!(COSMETIC_TYPES as string[]).includes(cosmeticType)) {
        throw new InvalidCosmeticTypeError(cosmeticType);
      }
    } else if (cosmeticType !== null) {
      throw new CosmeticTypeNotAllowedError(params.category);
    }

    const product: Product = {
      id: randomUUID(),
      sellerId: params.sellerId,
      title: params.title,
      description: params.description,
      game: params.game,
      category: params.category,
      rarity: params.rarity,
      priceCents: params.priceCents,
      cosmeticType,
      delisted: false,
      createdAt: new Date(),
      shopId: params.shopId ?? null,
    };

    return this.repository.save(product);
  }

  async findById(id: string): Promise<Product | null> {
    return this.repository.findById(id);
  }

  /**
   * Additive (Phase 4/Shops): all products attributed to a given shop
   * (`Product.shopId`), including delisted ones — callers that need only
   * active listings must filter on `delisted` themselves, same posture as
   * `getById()`/`findById()` not filtering delisted either.
   */
  async listByShopId(shopId: string): Promise<Product[]> {
    return this.repository.findByShopId(shopId);
  }

  async getById(id: string): Promise<Product> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  }

  /**
   * Soft delist toggle — delist ≠ delete, order history stays intact.
   * There is deliberately no hard-delete method anywhere in this module.
   * Only the listing product's seller may toggle it.
   */
  async setDelisted(productId: string, callerKobaId: string, delisted: boolean): Promise<Product> {
    const product = await this.getById(productId);
    if (product.sellerId !== callerKobaId) {
      throw new ProductNotOwnedByCallerError(productId, callerKobaId);
    }
    if (product.delisted === delisted) {
      return product;
    }
    return this.repository.save({ ...product, delisted });
  }
}
