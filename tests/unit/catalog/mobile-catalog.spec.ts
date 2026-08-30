import { MobileCatalogService } from '../../../src/modules/catalog/application/mobile-catalog.service';
import type { ProductVariant } from '../../../src/modules/catalog/domain/catalog.types';
import { toMobileVariant } from '../../../src/modules/catalog/presentation/mobile/mobile-catalog.mapper';

const onRequestVariant: ProductVariant = {
  id: 'variant-1',
  productId: 'product-1',
  sku: 'FOOD-1',
  barcode: null,
  presentation: '15 kg',
  weightGrams: 15_000,
  salePrice: '25000.00',
  compareAtPrice: '27000.00',
  active: true,
  preferredSupplierOfferId: 'offer-1',
  revision: 1,
  availableQuantity: 0,
  supplierStockStatus: 'ON_REQUEST',
  supplierLeadTimeHours: 48,
};

describe('Mobile catalog', () => {
  it('makes ON_REQUEST purchasable when its lead time is valid', () => {
    const result = toMobileVariant(onRequestVariant, {
      now: new Date('2026-01-01T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      salePrice: '25000.00',
      compareAtPrice: '27000.00',
      currency: 'ARS',
    });
    expect(result.fulfillment).toEqual({
      status: 'ON_REQUEST',
      purchasable: true,
      leadTimeHours: 48,
      availability: 'TOMORROW',
      earliestDeliveryDate: '2026-01-03',
      orderBefore: null,
    });
  });

  it('does not expose another customer purchases', async () => {
    const listMobileProducts = jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    const repository = {
      listMobileProducts,
      listPurchasedVariantIds: jest
        .fn()
        .mockResolvedValue(['variant-owned-by-customer']),
    };
    const customers = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    };
    const service = new MobileCatalogService(
      repository as never,
      { resolvePublicProduct: jest.fn() } as never,
      { list: jest.fn() } as never,
      { quote: jest.fn() } as never,
      customers as never,
    );

    await service.listProducts(
      { previouslyPurchased: true, limit: 10 },
      'user-1',
    );

    expect(customers.findByUserId).toHaveBeenCalledWith('user-1');
    expect(repository.listPurchasedVariantIds).toHaveBeenCalledWith(
      'customer-1',
    );
    expect(listMobileProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        purchasedVariantIds: ['variant-owned-by-customer'],
      }),
    );
  });

  it('returns no products for previouslyPurchased without authentication', async () => {
    const repository = { listMobileProducts: jest.fn() };
    const service = new MobileCatalogService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listProducts({ previouslyPurchased: true, limit: 10 }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(repository.listMobileProducts).not.toHaveBeenCalled();
  });
});
