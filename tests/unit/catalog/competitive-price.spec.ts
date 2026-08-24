import { calculateCompetitivePriceAverage } from '../../../src/modules/catalog/domain/competitive-price';

describe('calculateCompetitivePriceAverage', () => {
  it('uses the latest available exact observation per retailer', () => {
    const result = calculateCompetitivePriceAverage([
      {
        retailerCode: 'puppis',
        price: '60000.00',
        currency: 'ARS',
        availability: 'AVAILABLE',
        matchStatus: 'MATCHED',
        observedAt: new Date('2026-08-20T10:00:00Z'),
        sourceUrl: 'https://puppis.example/old',
      },
      {
        retailerCode: 'puppis',
        price: '62000.00',
        currency: 'ARS',
        availability: 'AVAILABLE',
        matchStatus: 'MATCHED',
        observedAt: new Date('2026-08-21T10:00:00Z'),
        sourceUrl: 'https://puppis.example/new',
      },
      {
        retailerCode: 'mispichos',
        price: null,
        currency: 'ARS',
        availability: 'UNKNOWN',
        matchStatus: 'BLOCKED',
        observedAt: new Date('2026-08-21T10:00:00Z'),
        sourceUrl: 'https://mispichos.example/product',
      },
    ]);

    expect(result.averagePrice).toBe('62000.00');
    expect(result.sampleCount).toBe(1);
    expect(result.expectedRetailerCount).toBe(4);
  });

  it('does not turn missing retailers into zero', () => {
    const result = calculateCompetitivePriceAverage([]);

    expect(result.averagePrice).toBeNull();
    expect(result.sampleCount).toBe(0);
  });
});
