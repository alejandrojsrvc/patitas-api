import { CatalogService } from '../../../src/modules/catalog/application/catalog.service';
import type {
  Brand,
  Category,
  Product,
  ProductVariant,
} from '../../../src/modules/catalog/domain/catalog.types';
import type { CatalogRepository } from '../../../src/modules/catalog/domain/repositories/catalog.repository';
import type { StorageProvider } from '../../../src/shared/application/ports/storage-provider.interface';

const brand: Brand = {
  id: 'brand-1',
  name: 'Excellent',
  slug: 'excellent',
  description: null,
  seoTitle: null,
  seoDescription: null,
  logoUrl: null,
  displayOrder: 0,
  active: true,
};

const category: Category = {
  id: 'category-1',
  name: 'Alimento seco',
  slug: 'alimento-seco',
  description: null,
  seoTitle: null,
  seoDescription: null,
  displayOrder: 0,
  parentId: null,
  active: true,
};

const variant: ProductVariant = {
  id: 'variant-1',
  productId: 'product-1',
  sku: 'MOCK-1',
  barcode: null,
  presentation: '3 kg',
  weightGrams: 3000,
  salePrice: '8990',
  compareAtPrice: null,
  active: true,
  preferredSupplierOfferId: null,
  revision: 1,
  availableQuantity: 0,
  supplierStockStatus: null,
  supplierLeadTimeHours: null,
};

const product: Product = {
  id: 'product-1',
  name: 'Producto mock',
  slug: 'producto-mock',
  description: 'Descripción',
  ingredientsText: null,
  analyticalComposition: null,
  brandId: brand.id,
  categoryId: category.id,
  species: 'DOG',
  line: 'Balance',
  lifeStage: 'ADULT',
  breedSize: 'ALL',
  estimatedDailyGramsPerKg: null,
  featuredRank: null,
  status: 'ACTIVE',
  brand,
  category,
  variants: [variant],
  media: [],
};

describe('CatalogService', () => {
  it('updates a variant without requiring the active product to be publishable', async () => {
    const updatedVariant = {
      ...variant,
      sku: 'PI-EXC-CAT-AD-75K',
      presentation: '7.5 kg',
      weightGrams: 7500,
      preferredSupplierOfferId: 'offer-1',
    };
    const updateVariant = jest.fn().mockResolvedValue(updatedVariant);
    const repository = {
      findProductByVariantId: jest.fn().mockResolvedValue(product),
      findSupplierOfferFulfillment: jest.fn().mockResolvedValue({
        stockStatus: 'AVAILABLE',
        leadTimeHours: 48,
      }),
      updateVariant,
    } as unknown as CatalogRepository;
    const service = new CatalogService(repository);

    await expect(
      service.updateVariant('variant-1', {
        sku: updatedVariant.sku,
        barcode: null,
        presentation: updatedVariant.presentation,
        weightGrams: updatedVariant.weightGrams,
        active: true,
        preferredSupplierOfferId: updatedVariant.preferredSupplierOfferId,
      }),
    ).resolves.toEqual(updatedVariant);

    expect(updateVariant).toHaveBeenCalledWith(
      'variant-1',
      expect.objectContaining({
        sku: 'PI-EXC-CAT-AD-75K',
        presentation: '7.5 kg',
        weightGrams: 7500,
        preferredSupplierOfferId: 'offer-1',
      }),
    );
  });

  it('calculates duration for imported products without a configured daily factor', async () => {
    const repository = {
      findPublicProductBySlug: jest.fn().mockResolvedValue(product),
      findActiveFeedingGuide: jest.fn().mockResolvedValue(null),
    } as unknown as CatalogRepository;
    const service = new CatalogService(repository);

    const result = await service.calculateFoodDuration({
      productSlug: product.slug,
      variantId: variant.id,
      petWeightKg: 10,
    });

    expect(result.source).toBe('GENERAL_FALLBACK');
    expect(result.dailyGrams).toEqual({ min: 170, max: 170 });
    expect(result.durationDays).toEqual({ min: 17.6, max: 17.6 });
  });

  it('returns stable public URLs for product media', async () => {
    const products = [
      {
        ...product,
        media: [
          {
            id: 'media-1',
            productId: product.id,
            variantId: null,
            url: 'products/product-1/front.jpg',
            altText: 'Frente',
            displayOrder: 0,
          },
        ],
      },
      {
        ...product,
        id: 'product-2',
        slug: 'producto-2',
        media: [
          {
            id: 'media-2',
            productId: 'product-2',
            variantId: null,
            url: 'products/product-2/front.jpg',
            altText: 'Frente',
            displayOrder: 0,
          },
        ],
      },
    ];
    const repository = {
      listPublicProducts: jest.fn().mockResolvedValue({
        items: products,
        page: 1,
        perPage: 24,
        total: 2,
      }),
    } as unknown as CatalogRepository;
    const getPublicUrl = jest.fn(
      ({ path }: { path: string }) => `https://cdn.test/${path}`,
    );
    const storage = { getPublicUrl } as unknown as StorageProvider;
    const service = new CatalogService(repository, storage);

    const result = await service.listPublicProducts({ page: 1, perPage: 24 });

    expect(getPublicUrl).toHaveBeenCalledTimes(2);
    expect(result.items.map((item) => item.media[0].url)).toEqual([
      'https://cdn.test/products/product-1/front.jpg',
      'https://cdn.test/products/product-2/front.jpg',
    ]);
  });

  it('returns stable public URLs for brand logos', async () => {
    const repository = {
      listBrands: jest.fn().mockResolvedValue([
        { ...brand, logoUrl: 'brands/brand-1/logo.png' },
        {
          ...brand,
          id: 'brand-2',
          slug: 'brand-2',
          logoUrl: 'brands/brand-2/logo.png',
        },
      ]),
    } as unknown as CatalogRepository;
    const getPublicUrl = jest.fn(
      ({ path }: { path: string }) => `https://cdn.test/${path}`,
    );
    const service = new CatalogService(repository, {
      getPublicUrl,
    } as unknown as StorageProvider);

    const result = await service.listBrands(true);

    expect(getPublicUrl).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.logoUrl)).toEqual([
      'https://cdn.test/brands/brand-1/logo.png',
      'https://cdn.test/brands/brand-2/logo.png',
    ]);
  });
});
