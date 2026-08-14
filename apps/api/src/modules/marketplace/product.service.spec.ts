import { InMemoryProductRepository } from './in-memory-product.repository';
import {
  CosmeticTypeNotAllowedError,
  CosmeticTypeRequiredError,
  InvalidMoneyAmountError,
  InvalidProductCategoryError,
  InvalidRarityTierError,
  ProductNotFoundError,
  ProductNotOwnedByCallerError,
  UnsupportedGameError,
} from './marketplace.errors';
import { ProductService } from './product.service';
import { CosmeticType, CreateProductParams, ProductCategory, RarityTier } from './marketplace.types';

describe('ProductService', () => {
  let repository: InMemoryProductRepository;
  let service: ProductService;

  beforeEach(() => {
    repository = new InMemoryProductRepository();
    service = new ProductService(repository);
  });

  function baseParams(overrides: Partial<CreateProductParams> = {}): CreateProductParams {
    return {
      sellerId: 'KOBA-BZ-AAAA',
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
    it('creates a non-cosmetic product', async () => {
      const product = await service.createProduct(baseParams());

      expect(product.id).toBeDefined();
      expect(product.game).toBe('Rust');
      expect(product.category).toBe(ProductCategory.MONUMENT);
      expect(product.rarity).toBe(RarityTier.RARE);
      expect(product.priceCents).toBe(4_600);
      expect(product.cosmeticType).toBeNull();
      expect(product.delisted).toBe(false);
      expect(product.createdAt).toBeInstanceOf(Date);
    });

    it('creates a cosmetic product with a cosmeticType', async () => {
      const product = await service.createProduct(
        baseParams({
          category: ProductCategory.COSMETIC,
          cosmeticType: CosmeticType.NAMEPLATE,
          priceCents: 500,
        }),
      );

      expect(product.category).toBe(ProductCategory.COSMETIC);
      expect(product.cosmeticType).toBe(CosmeticType.NAMEPLATE);
    });

    it('rejects a cosmetic product with no cosmeticType', async () => {
      await expect(
        service.createProduct(baseParams({ category: ProductCategory.COSMETIC })),
      ).rejects.toThrow(CosmeticTypeRequiredError);
    });

    it('rejects a non-cosmetic product that carries a cosmeticType', async () => {
      await expect(
        service.createProduct(
          baseParams({ category: ProductCategory.SKIN, cosmeticType: CosmeticType.NAMEPLATE }),
        ),
      ).rejects.toThrow(CosmeticTypeNotAllowedError);
    });

    it('rejects an unsupported game', async () => {
      await expect(service.createProduct(baseParams({ game: 'Not A Real Game' }))).rejects.toThrow(
        UnsupportedGameError,
      );
    });

    it('rejects an invalid category', async () => {
      await expect(
        service.createProduct(baseParams({ category: 'pack' as ProductCategory })),
      ).rejects.toThrow(InvalidProductCategoryError);
    });

    it('rejects an invalid rarity tier', async () => {
      await expect(
        service.createProduct(baseParams({ rarity: 'mythic' as RarityTier })),
      ).rejects.toThrow(InvalidRarityTierError);
    });

    it('rejects a non-integer priceCents', async () => {
      await expect(service.createProduct(baseParams({ priceCents: 46.5 }))).rejects.toThrow(
        InvalidMoneyAmountError,
      );
    });

    it('rejects a negative priceCents', async () => {
      await expect(service.createProduct(baseParams({ priceCents: -100 }))).rejects.toThrow(
        InvalidMoneyAmountError,
      );
    });
  });

  describe('getById / findById', () => {
    it('throws ProductNotFoundError for an unknown id', async () => {
      await expect(service.getById('does-not-exist')).rejects.toThrow(ProductNotFoundError);
    });

    it('findById returns null for an unknown id', async () => {
      expect(await service.findById('does-not-exist')).toBeNull();
    });
  });

  describe('setDelisted', () => {
    it('delists a product and the product remains fetchable afterwards', async () => {
      const product = await service.createProduct(baseParams());

      const delisted = await service.setDelisted(product.id, product.sellerId, true);
      expect(delisted.delisted).toBe(true);

      const fetched = await service.getById(product.id);
      expect(fetched.delisted).toBe(true);
      expect(fetched.id).toBe(product.id);
    });

    it('re-lists a delisted product', async () => {
      const product = await service.createProduct(baseParams());
      await service.setDelisted(product.id, product.sellerId, true);

      const relisted = await service.setDelisted(product.id, product.sellerId, false);
      expect(relisted.delisted).toBe(false);
    });

    it('only the seller may toggle delisted', async () => {
      const product = await service.createProduct(baseParams());

      await expect(service.setDelisted(product.id, 'KOBA-PL-ZZZZ', true)).rejects.toThrow(
        ProductNotOwnedByCallerError,
      );
    });

    it('does not mutate other fields when delisting', async () => {
      const product = await service.createProduct(baseParams());

      const delisted = await service.setDelisted(product.id, product.sellerId, true);

      expect(delisted.title).toBe(product.title);
      expect(delisted.priceCents).toBe(product.priceCents);
      expect(delisted.rarity).toBe(product.rarity);
      expect(delisted.createdAt).toEqual(product.createdAt);
    });
  });
});
