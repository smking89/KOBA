import { InMemoryProductRepository } from '../marketplace/in-memory-product.repository';
import { InMemorySellerVerificationRepository } from '../marketplace/in-memory-seller-verification.repository';
import { InMemoryStripeAccountRepository } from '../marketplace/in-memory-stripe-account.repository';
import { CosmeticType, ProductCategory, RarityTier } from '../marketplace/marketplace.types';
import { StripeAccountNotActiveError, ProductNotOwnedByCallerError } from '../marketplace/marketplace.errors';
import { ProductService } from '../marketplace/product.service';
import { StripeConnectService } from '../marketplace/stripe-connect.service';
import { StripeAccountStatus } from '../marketplace/stripe-connect.types';
import { InMemoryShopRepository } from './in-memory-shop.repository';
import { CreateShopProductParams, ShopProductService } from './shop-product.service';
import { ProductNotPartOfShopError, ShopNotOwnedByCallerError } from './shop.errors';
import { ShopService } from './shop.service';

describe('ShopProductService', () => {
  let shopRepository: InMemoryShopRepository;
  let productRepository: InMemoryProductRepository;
  let stripeAccountRepository: InMemoryStripeAccountRepository;
  let sellerVerificationRepository: InMemorySellerVerificationRepository;
  let shopService: ShopService;
  let productService: ProductService;
  let stripeConnectService: StripeConnectService;
  let service: ShopProductService;

  const OWNER = 'KOBA-BZ-AAAA';

  beforeEach(() => {
    shopRepository = new InMemoryShopRepository();
    productRepository = new InMemoryProductRepository();
    stripeAccountRepository = new InMemoryStripeAccountRepository();
    sellerVerificationRepository = new InMemorySellerVerificationRepository();

    shopService = new ShopService(shopRepository);
    productService = new ProductService(productRepository);
    stripeConnectService = new StripeConnectService(
      stripeAccountRepository,
      { standardRate: 0.08, verifiedRate: 0.04 },
      sellerVerificationRepository,
    );
    service = new ShopProductService(shopService, productService, stripeConnectService);
  });

  async function createShop() {
    return shopService.createShop({ ownerKobaId: OWNER, name: 'Oxide Outfitters' });
  }

  function baseProductParams(overrides: Partial<CreateShopProductParams> = {}): CreateShopProductParams {
    return {
      title: 'Oxide Camo Monument Kit',
      description: 'A camo monument kit',
      game: 'Rust',
      category: ProductCategory.MONUMENT,
      rarity: RarityTier.RARE,
      priceCents: 4_600,
      ...overrides,
    };
  }

  describe('createProduct', () => {
    it('blocks product creation while the shop Stripe status is not active', async () => {
      const shop = await createShop();

      await expect(service.createProduct(shop.id, OWNER, baseProductParams())).rejects.toThrow(
        StripeAccountNotActiveError,
      );
    });

    it('creates a product attributed to the shop once Stripe is active', async () => {
      const shop = await createShop();
      await stripeConnectService.setStatus(OWNER, StripeAccountStatus.ACTIVE);

      const product = await service.createProduct(shop.id, OWNER, baseProductParams());

      expect(product.shopId).toBe(shop.id);
      expect(product.sellerId).toBe(OWNER);
    });

    it('only the shop owner may create a product through it', async () => {
      const shop = await createShop();
      await stripeConnectService.setStatus(OWNER, StripeAccountStatus.ACTIVE);

      await expect(
        service.createProduct(shop.id, 'KOBA-BZ-ZZZZ', baseProductParams()),
      ).rejects.toThrow(ShopNotOwnedByCallerError);
    });
  });

  describe('setDelisted', () => {
    async function createActiveShopWithProduct() {
      const shop = await createShop();
      await stripeConnectService.setStatus(OWNER, StripeAccountStatus.ACTIVE);
      const product = await service.createProduct(shop.id, OWNER, baseProductParams());
      return { shop, product };
    }

    it('lets the owner delist and relist a shop product', async () => {
      const { shop, product } = await createActiveShopWithProduct();

      const delisted = await service.setDelisted(shop.id, OWNER, product.id, true);
      expect(delisted.delisted).toBe(true);

      const relisted = await service.setDelisted(shop.id, OWNER, product.id, false);
      expect(relisted.delisted).toBe(false);
    });

    it('blocks a non-owner from delisting', async () => {
      const { shop, product } = await createActiveShopWithProduct();

      await expect(
        service.setDelisted(shop.id, 'KOBA-BZ-ZZZZ', product.id, true),
      ).rejects.toThrow(ShopNotOwnedByCallerError);
    });

    it('rejects delisting a product that is not part of this shop', async () => {
      const { shop } = await createActiveShopWithProduct();
      const otherProduct = await productService.createProduct({
        sellerId: OWNER,
        title: 'Standalone listing',
        description: 'Not attributed to any shop',
        game: 'Rust',
        category: ProductCategory.SKIN,
        rarity: RarityTier.COMMON,
        priceCents: 100,
      });

      await expect(
        service.setDelisted(shop.id, OWNER, otherProduct.id, true),
      ).rejects.toThrow(ProductNotPartOfShopError);
    });

    it('never lets a raw ProductService call bypass shop ownership (sanity check on the underlying gate)', async () => {
      const { product } = await createActiveShopWithProduct();

      await expect(productService.setDelisted(product.id, 'KOBA-BZ-ZZZZ', true)).rejects.toThrow(
        ProductNotOwnedByCallerError,
      );
    });
  });

  describe('listProducts', () => {
    it('lists all of a shop products and filters by cosmeticType', async () => {
      const shop = await createShop();
      await stripeConnectService.setStatus(OWNER, StripeAccountStatus.ACTIVE);

      const monument = await service.createProduct(shop.id, OWNER, baseProductParams());
      const cosmetic = await service.createProduct(
        shop.id,
        OWNER,
        baseProductParams({
          category: ProductCategory.COSMETIC,
          cosmeticType: CosmeticType.NAMEPLATE,
          priceCents: 500,
        }),
      );

      const all = await service.listProducts(shop.id);
      expect(all.map((p) => p.id).sort()).toEqual([monument.id, cosmetic.id].sort());

      const cosmeticsOnly = await service.listProducts(shop.id, { cosmeticType: CosmeticType.NAMEPLATE });
      expect(cosmeticsOnly).toHaveLength(1);
      expect(cosmeticsOnly[0].id).toBe(cosmetic.id);
    });
  });
});
