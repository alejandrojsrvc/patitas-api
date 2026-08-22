import { CatalogService } from '../../../src/modules/catalog/application/catalog.service';
import type {
  Brand,
  Category,
  Product,
  ProductVariant,
} from '../../../src/modules/catalog/domain/catalog.types';
import type { CatalogRepository } from '../../../src/modules/catalog/domain/repositories/catalog.repository';

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
});
