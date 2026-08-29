import { calculateShipping } from '../../../src/modules/shipping/domain/shipping-calculator';
import type { ShippingZone } from '../../../src/modules/shipping/domain/shipping.types';

const zone = (overrides: Partial<ShippingZone> = {}): ShippingZone => ({
  id: 'zone-id',
  name: 'CABA',
  type: 'NEIGHBORHOOD',
  active: true,
  priority: 1,
  postalCodes: [],
  neighborhoods: ['CABA', 'Capital Federal', 'Ciudad Autónoma de Buenos Aires'],
  polygon: null,
  cost: '3711.00',
  freeShippingFrom: null,
  maxWeightGrams: 30000,
  estimatedDaysMin: 1,
  estimatedDaysMax: 2,
  deliveryWindows: {
    collectionCutoffs: [
      { time: '13:00', coverage: 'AMBA' },
      { time: '15:00', coverage: 'CABA' },
    ],
  },
  ...overrides,
});

describe('shipping calculator', () => {
  it('calculates one delivery with VAT and subsidy', () => {
    expect(
      calculateShipping(
        [zone()],
        { city: 'Capital Federal', subtotal: '10000.00', weightGrams: 20000 },
        '3200.00',
      ),
    ).toMatchObject({
      available: true,
      providerCost: '4490.31',
      vat: '779.31',
      subsidy: '3200.00',
      cost: '1290.31',
      deliveryCount: 1,
      cutoffs: [
        { time: '13:00', coverage: 'AMBA' },
        { time: '15:00', coverage: 'CABA' },
      ],
    });
  });

  it('charges two deliveries between 20 and 30 kilograms', () => {
    expect(
      calculateShipping(
        [zone()],
        { city: 'CABA', subtotal: '10000.00', weightGrams: 20001 },
        '3200.00',
      ),
    ).toMatchObject({
      available: true,
      providerCost: '8980.62',
      subsidy: '3200.00',
      cost: '5780.62',
      deliveryCount: 2,
    });
  });

  it('matches CABA by its postal code range', () => {
    expect(
      calculateShipping(
        [
          zone({
            neighborhoods: [],
            deliveryWindows: {
              postalCodeRanges: [{ min: 1000, max: 1499 }],
            },
          }),
        ],
        {
          postalCode: '1414',
          city: 'Buenos Aires',
          subtotal: '10000.00',
          weightGrams: 10000,
        },
        '3200.00',
      ).available,
    ).toBe(true);
  });

  it('rejects shipments over 30 kilograms or without weight', () => {
    expect(
      calculateShipping(
        [zone()],
        { city: 'CABA', subtotal: '10000.00', weightGrams: 30001 },
        '3200.00',
      ).available,
    ).toBe(false);
    expect(
      calculateShipping(
        [zone()],
        { city: 'CABA', subtotal: '10000.00' },
        '3200.00',
      ).available,
    ).toBe(false);
  });
});
