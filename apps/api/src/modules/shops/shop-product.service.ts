import { Injectable } from '@nestjs/common';
import { CosmeticType, CreateProductParams, Product } from '../marketplace/marketplace.types';
import { ProductService } from '../marketplace/product.service';
import { StripeConnectService } from '../marketplace/stripe-connect.service';
import { assertShopOwner } from './shop-authorization.util';
import { ProductNotPartOfShopError } from './shop.errors';
import { ShopService } from './shop.service';

/** `CreateProductParams` minus the fields this service derives itself (seller/shop attribution). */
export type CreateShopProductParams = Omit<CreateProductParams, 'sellerId' | 'shopId'>;

/**
 * Thin wrapper around marketplace's existing `ProductService` — enforces
 * that only a shop's owner may create/delist products attributed to that
 * shop, attributes every product created "through" a shop with
 * `Product.shopId`, and gates product creation on the shop's Stripe
 * Connect status being `active` (ROADMAP.md Phase 4: "a shop cannot sell
 * — create products / receive orders — while its Stripe status isn't
 * active"). Reuses marketplace's existing status-gating
 * (`StripeConnectService#assertSellerCanReceivePayouts()`) rather than
 * reimplementing it; order-time gating is already handled by
 * marketplace's own `OrderService`.
 */
@Injectable()
export class ShopProductService {
  constructor(
    private readonly shopService: ShopService,
    private readonly productService: ProductService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  async createProduct(shopId: string, callerKobaId: string, params: CreateShopProductParams): Promise<Product> {
    const shop = await this.shopService.getById(shopId);
    assertShopOwner(shop, callerKobaId);

    // Throws StripeAccountNotActiveError (marketplace.errors.ts) unless
    // the shop owner's Stripe Connect status is `active` — see
    // ShopStripeConnectService for the notConnected -> pending -> active
    // transitions this gate is checking against.
    await this.stripeConnectService.assertSellerCanReceivePayouts(shop.ownerKobaId);

    return this.productService.createProduct({
      ...params,
      sellerId: shop.ownerKobaId,
      shopId: shop.id,
    });
  }

  /**
   * Soft delist/relist toggle, delegating to `ProductService#setDelisted()`.
   * Only the shop's owner may act, and only for a product actually
   * attributed to this shop (`ProductNotPartOfShopError` otherwise).
   */
  async setDelisted(shopId: string, callerKobaId: string, productId: string, delisted: boolean): Promise<Product> {
    const shop = await this.shopService.getById(shopId);
    assertShopOwner(shop, callerKobaId);

    const product = await this.productService.getById(productId);
    if (product.shopId !== shopId) {
      throw new ProductNotPartOfShopError(shopId, productId);
    }

    return this.productService.setDelisted(productId, shop.ownerKobaId, delisted);
  }

  /**
   * All of a shop's products, optionally filtered by `cosmeticType` — the
   * existing `CosmeticType` enum from marketplace (avatarDecoration |
   * profileEffect | nameplate). No new modeling: `Product` already
   * carries `category`/`cosmeticType` (Phase 3), this is just a query
   * parameter on the listing method.
   */
  async listProducts(shopId: string, filters?: { cosmeticType?: CosmeticType }): Promise<Product[]> {
    const products = await this.productService.listByShopId(shopId);
    if (!filters?.cosmeticType) {
      return products;
    }
    return products.filter((product) => product.cosmeticType === filters.cosmeticType);
  }
}
