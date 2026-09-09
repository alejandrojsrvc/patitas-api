import { calculateShipping } from '../../../src/modules/shipping/domain/shipping-calculator';
import type { ShippingZone } from '../../../src/modules/shipping/domain/shipping.types';

const zone = (overrides: Partial<ShippingZone> = {}): ShippingZone => ({
  id: 'zone-id',
  name: 'CABA',
  type: 'NEIGHBORHOOD',
  region: 'CABA',
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
    daysOfWeek: [1, 2, 3, 4, 5],
    cutoff: '15:00',
    collectionCutoffs: [
      { time: '13:00', coverage: 'AMBA' },
      { time: '15:00', coverage: 'CABA' },
    ],
    deliverySlots: [
      {
        id: 'STANDARD_13_19',
        label: '13:00 a 19:00',
        start: '13:00',
        end: '19:00',
      },
    ],
    timezone: 'America/Argentina/Buenos_Aires',
  },
  ...overrides,
});

describe('shipping calculator', () => {
  it('calculates one delivery with VAT and subsidy', () => {
    expect(calculateShipping([zone()], { city: 'Capital Federal', subtotal: '10000.00', weightGrams: 20000 }, '3200.00')).toMatchObject({
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
    expect(calculateShipping([zone()], { city: 'CABA', subtotal: '10000.00', weightGrams: 20001 }, '3200.00')).toMatchObject({
      available: true,
      providerCost: '8980.62',
      subsidy: '3200.00',
      cost: '5780.62',
      deliveryCount: 2,
    });
  });

  it.each([
    [5_000, 1],
    [15_000, 1],
    [20_000, 1],
    [20_001, 2],
    [25_000, 2],
    [30_000, 2],
  ])('uses %s grams as %s delivery unit(s)', (weightGrams, deliveryCount) => {
    expect(calculateShipping([zone()], { city: 'CABA', subtotal: '10000.00', weightGrams }, '0.00')).toMatchObject({
      available: true,
      deliveryCount,
    });
  });

  it('matches CABA by its postal code range', () => {
    expect(
      calculateShipping(
        [
          zone({
            neighborhoods: [],
            deliveryWindows: {
              daysOfWeek: [1, 2, 3, 4, 5],
              cutoff: '15:00',
              postalCodeRanges: [{ min: 1000, max: 1499 }],
              deliverySlots: [
                {
                  id: 'STANDARD_13_19',
                  label: '13:00 a 19:00',
                  start: '13:00',
                  end: '19:00',
                },
              ],
              timezone: 'America/Argentina/Buenos_Aires',
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
    expect(calculateShipping([zone()], { city: 'CABA', subtotal: '10000.00', weightGrams: 30001 }, '3200.00').available).toBe(false);
    expect(calculateShipping([zone()], { city: 'CABA', subtotal: '10000.00' }, '0.00').reasonCode).toBe('WEIGHT_UNAVAILABLE');
    expect(calculateShipping([zone()], { city: 'CABA', subtotal: '10000.00' }, '3200.00').available).toBe(false);
  });

  it('returns one generic slot across several operational dates', () => {
    const result = calculateShipping(
      [
        zone({
          deliveryWindows: {
            daysOfWeek: [1, 2, 3, 4, 5],
            cutoff: '13:00',
            collectionCutoffs: [
              { time: '13:00', coverage: 'AMBA' },
              { time: '15:00', coverage: 'CABA' },
            ],
            deliverySlots: [
              {
                id: 'STANDARD_13_19',
                label: '13:00 a 19:00',
                start: '13:00',
                end: '19:00',
              },
            ],
            timezone: 'America/Argentina/Buenos_Aires',
          },
        }),
      ],
      {
        city: 'CABA',
        subtotal: '10000.00',
        weightGrams: 10000,
        now: new Date('2026-09-04T17:00:00.000Z'),
      },
      '0.00',
    );

    expect(result.deliverySlots).toHaveLength(7);
    expect(result.deliverySlots[0]).toMatchObject({
      id: 'STANDARD_13_19',
      date: '2026-09-04',
      label: '13:00 a 19:00',
    });
  });

  it('exposes the free-shipping threshold without changing the raw tariff', () => {
    const result = calculateShipping([zone({ freeShippingFrom: '55000.00' })], { city: 'CABA', subtotal: '54000.00', weightGrams: 10000 }, '0.00');

    expect(result).toMatchObject({
      freeShippingFrom: '55000.00',
      eligibleAmount: '54000.00',
      remainingForFreeShipping: '1000.00',
      providerCost: '4490.31',
      cost: '4490.31',
    });
  });
});
