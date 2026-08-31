import { calculateVariantFulfillment } from '../../../src/modules/fulfillment/application/fulfillment.service';
import type { ProductVariant } from '../../../src/modules/catalog/domain/catalog.types';
import type { FulfillmentSettings } from '../../../src/modules/fulfillment/domain/fulfillment.types';

const settings: FulfillmentSettings = {
  id: 'settings-1',
  timezone: 'America/Argentina/Buenos_Aires',
  depotCutoff: '14:00',
  sameDayEnabled: true,
  depotHandlingMinutes: 30,
  updatedAt: new Date('2026-08-31T12:00:00.000Z'),
};

const variant = (input: Partial<ProductVariant>): ProductVariant => ({
  id: 'variant-1',
  productId: 'product-1',
  sku: 'SKU-1',
  barcode: null,
  presentation: '7,5 kg',
  weightGrams: 7500,
  salePrice: '10000.00',
  compareAtPrice: null,
  active: true,
  preferredSupplierOfferId: null,
  revision: 1,
  availableQuantity: 0,
  supplierStockStatus: 'AVAILABLE',
  supplierLeadTimeHours: 1,
  supplierFulfillmentMode: 'EXPRESS',
  supplierCutoff: '13:00',
  supplierToDepotMinutes: 30,
  supplierFulfillmentCost: '500.00',
  ...input,
});

describe('FulfillmentService', () => {
  it('uses own stock and the depot cutoff for same-day availability', () => {
    expect(
      calculateVariantFulfillment(
        variant({ availableQuantity: 2 }),
        settings,
        new Date('2026-08-31T15:00:00.000Z'),
      ),
    ).toMatchObject({
      status: 'IN_STOCK',
      availability: 'TODAY',
      label: 'Entrega hoy',
      availableQuantity: 2,
    });
  });

  it('uses express supplier only when the depot has enough remaining time', () => {
    expect(
      calculateVariantFulfillment(
        variant({ availableQuantity: 0 }),
        settings,
        new Date('2026-08-31T15:00:00.000Z'),
      ),
    ).toMatchObject({
      status: 'SUPPLIER_EXPRESS',
      purchasable: true,
      availability: 'TODAY',
      supplierFulfillmentCost: '500.00',
    });
  });

  it('does not promise express delivery after the supplier cutoff', () => {
    expect(
      calculateVariantFulfillment(
        variant({ supplierCutoff: '11:00' }),
        settings,
        new Date('2026-08-31T15:00:00.000Z'),
      ),
    ).toMatchObject({
      status: 'SUPPLIER_STANDARD',
      availability: 'TOMORROW',
      purchasable: true,
    });
  });
});
