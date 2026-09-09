import { MobileCatalogService } from '../../../src/modules/catalog/application/mobile-catalog.service';
import type { Product, ProductVariant } from '../../../src/modules/catalog/domain/catalog.types';
import { MobileCategoriesController } from '../../../src/modules/catalog/presentation/mobile/mobile-categories.controller';
import { MobileOffersController } from '../../../src/modules/catalog/presentation/mobile/mobile-offers.controller';
import { MobileProductsController } from '../../../src/modules/catalog/presentation/mobile/mobile-products.controller';

const variant: ProductVariant = {
  id: 'variant-1',
  productId: 'product-1',
  sku: 'ROYAL-3KG',
  barcode: null,
  presentation: '3 kg',
  weightGrams: 3_000,
  salePrice: '8990.00',
  compareAtPrice: '9990.00',
  active: true,
  preferredSupplierOfferId: null,
  revision: 1,
  availableQuantity: 4,
  supplierStockStatus: null,
  supplierLeadTimeHours: null,
};

const product: Product = {
  id: 'product-1',
  name: 'Royal Canino',
  slug: 'royal-canino',
  description: 'Alimento completo.',
  ingredientsText: null,
  analyticalComposition: null,
  brandId: 'brand-1',
  categoryId: 'category-1',
  species: 'dog',
  line: null,
  lifeStage: 'adult',
  breedSize: null,
  estimatedDailyGramsPerKg: null,
  featuredRank: 1,
  status: 'ACTIVE',
  brand: { id: 'brand-1', name: 'Royal', slug: 'royal' },
  category: {
    id: 'category-1',
    name: 'Alimentos',
    slug: 'alimentos',
    description: null,
    seoTitle: null,
    seoDescription: null,
    displayOrder: 2,
    parentId: null,
    active: true,
  },
  variants: [variant],
  media: [
    {
      id: 'media-1',
      url: 'https://cdn.test/royal.webp',
      altText: 'Royal Canino',
      displayOrder: 0,
      variantId: null,
    },
  ],
};

describe('Mobile catalog controllers', () => {
  it('returns the mobile product page contract', async () => {
    const listProducts = jest.fn().mockResolvedValue({
      items: [{ product, shippingQuotes: new Map() }],
      nextCursor: 'cursor-next',
    });
    const controller = new MobileProductsController({
      listProducts,
    } as unknown as MobileCatalogService);

    const result = await controller.list({ limit: 24 });

    expect(result).toMatchObject({
      nextCursor: 'cursor-next',
      items: [
        expect.objectContaining({
          id: 'product-1',
          name: 'Royal Canino',
          slug: 'royal-canino',
          species: 'dog',
          brand: { id: 'brand-1', name: 'Royal', slug: 'royal' },
          category: {
            id: 'category-1',
            name: 'Alimentos',
            slug: 'alimentos',
          },
          image: {
            url: 'https://cdn.test/royal.webp',
            altText: 'Royal Canino',
          },
        }),
      ],
    });
    expect(result.items[0]?.variants[0]).toMatchObject({
      id: 'variant-1',
      salePrice: '8990.00',
      currency: 'ARS',
      fulfillment: { status: 'IN_STOCK', purchasable: true },
    });
    expect(listProducts).toHaveBeenCalledWith({ limit: 24 }, undefined);
  });

  it('returns the mobile product detail contract', async () => {
    const getProduct = jest.fn().mockResolvedValue({
      product,
      shippingQuotes: new Map(),
    });
    const controller = new MobileProductsController({
      getProduct,
    } as unknown as MobileCatalogService);

    const result = await controller.product('royal-canino', { limit: 24 });

    expect(result).toMatchObject({
      id: 'product-1',
      slug: 'royal-canino',
      variants: [expect.objectContaining({ id: 'variant-1' })],
    });
    expect(getProduct).toHaveBeenCalledWith('royal-canino', { limit: 24 });
  });

  it('returns autocomplete items inside the mobile page envelope', async () => {
    const autocomplete = {
      id: 'variant-1',
      productId: 'product-1',
      slug: 'royal-canino',
      name: 'Royal Canino',
      presentation: '3 kg',
      displayName: 'Royal Canino · 3 kg',
      brand: { id: 'brand-1', name: 'Royal', slug: 'royal' },
      image: null,
      salePrice: '8990.00',
      currency: 'ARS' as const,
    };
    const autocompleteProducts = jest.fn().mockResolvedValue([autocomplete]);
    const controller = new MobileProductsController({
      autocompleteProducts,
    } as unknown as MobileCatalogService);

    await expect(controller.autocomplete({ q: 'roy' })).resolves.toEqual({
      items: [autocomplete],
    });
    expect(autocompleteProducts).toHaveBeenCalledWith('roy');
  });

  it('maps categories to the mobile category fields', async () => {
    const listCategories = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'category-1',
          name: 'Alimentos',
          slug: 'alimentos',
          parentId: null,
          displayOrder: 2,
        },
      ],
      nextCursor: null,
    });
    const controller = new MobileCategoriesController({
      listCategories,
    } as unknown as MobileCatalogService);

    await expect(controller.list({ cursor: undefined, limit: 24 })).resolves.toEqual({
      items: [
        {
          id: 'category-1',
          name: 'Alimentos',
          slug: 'alimentos',
          parentId: null,
          sortOrder: 2,
        },
      ],
      nextCursor: null,
    });
    expect(listCategories).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 24,
    });
  });

  it('maps offers to the mobile offer fields', async () => {
    const startsAt = new Date('2026-09-01T00:00:00.000Z');
    const endsAt = new Date('2026-09-30T23:59:59.000Z');
    const listOffers = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'offer-1',
          name: '10% de descuento',
          type: 'PERCENTAGE',
          kind: 'DISCOUNT',
          value: '10.00',
          startsAt,
          endsAt,
        },
      ],
      nextCursor: null,
    });
    const controller = new MobileOffersController({
      listOffers,
    } as unknown as MobileCatalogService);

    await expect(controller.list({ limit: 24 }, undefined)).resolves.toEqual({
      items: [
        {
          id: 'offer-1',
          type: 'PERCENTAGE_DISCOUNT',
          title: '10% de descuento',
          description: '10% de descuento',
          percentage: '10.00',
          amount: null,
          currency: null,
          appliesAutomatically: true,
          startsAt,
          endsAt,
        },
      ],
      nextCursor: null,
    });
    expect(listOffers).toHaveBeenCalledWith({ limit: 24 }, undefined);
  });
});
