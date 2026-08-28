import { PricingScenarioCalculator } from '../../../src/modules/pricing/domain/pricing-scenario-calculator';

describe('PricingScenarioCalculator', () => {
  it('calculates projected result and break-even with 20 manual orders', () => {
    const result = new PricingScenarioCalculator().calculate({
      scenario: {
        id: 'scenario-id',
        name: 'Primer mes',
        periodStart: new Date('2026-08-01T00:00:00Z'),
        periodEnd: new Date('2026-09-01T00:00:00Z'),
        ordersSource: 'MANUAL',
        projectedOrders: 20,
        averageItemsPerOrder: '1.00',
        paymentFeeScheduleId: 'schedule-id',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      rules: {
        id: 'rules-id',
        version: 1,
        status: 'ACTIVE',
        currency: 'ARS',
        fulfillmentCost: '0.00',
        packagingCost: '1500.00',
        paymentFixedCost: '0.00',
        paymentFeePercent: '6.29',
        paymentFeeVatApplies: true,
        paymentFeeVatPercent: '21.00',
        paymentFeeScheduleId: 'schedule-id',
        subsidizedShippingCost: '3200.00',
        taxPercent: '0.00',
        otherCost: '0.00',
        targetMarginPercent: '30.00',
        createdAt: new Date(),
        activatedAt: new Date(),
      },
      operatingCosts: [
        {
          id: 'deposit',
          name: 'Depósito',
          type: 'FIXED_MONTHLY',
          amount: '220000.00',
          percent: null,
          currency: 'ARS',
          active: true,
          effectiveFrom: new Date(),
          effectiveTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'tax',
          name: 'Monotributo',
          type: 'FIXED_MONTHLY',
          amount: '80000.00',
          percent: null,
          currency: 'ARS',
          active: true,
          effectiveFrom: new Date(),
          effectiveTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      variants: [{ salePrice: '20000.00', unitCost: '10000.00' }],
      previousPeriodOrders: null,
    });

    expect(result.ordersUsed).toBe(20);
    expect(result.fixedMonthlyCosts).toBe('300000.00');
    expect(result.averageContributionPerOrder).toBe('3777.82');
    expect(result.breakEvenOrders).toBe(80);
    expect(result.projectedOperatingResult).toBe('-224443.60');
    expect(result.catalogCoverage).toMatchObject({
      variantsConsidered: 1,
      variantsIncluded: 1,
      variantsWithoutActiveOffer: 0,
      inventoryUsed: false,
      productStatusFilterApplied: false,
    });
    expect(result.costBreakdown.totals.fixedMonthly).toBe('300000.00');
    expect(result.costBreakdown.rules.paymentFeeEffectivePercent).toBe(
      '7.6109',
    );
    expect(result.costBreakdown.averages.costsPerOrder).toBe('4700.00');
    expect(result.costBreakdown.averages.contributionPerOrder).toBe('3777.82');
  });

  it('uses the previous period orders when available', () => {
    const result = new PricingScenarioCalculator().calculate({
      scenario: {
        id: 'scenario-id',
        name: 'Siguiente mes',
        periodStart: new Date('2026-09-01T00:00:00Z'),
        periodEnd: new Date('2026-10-01T00:00:00Z'),
        ordersSource: 'PREVIOUS_PERIOD',
        projectedOrders: 20,
        averageItemsPerOrder: '1.00',
        paymentFeeScheduleId: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      rules: {
        id: 'rules-id',
        version: 1,
        status: 'ACTIVE',
        currency: 'ARS',
        fulfillmentCost: '0.00',
        packagingCost: '0.00',
        paymentFixedCost: '0.00',
        paymentFeePercent: '0.00',
        paymentFeeVatApplies: true,
        paymentFeeVatPercent: '0.00',
        paymentFeeScheduleId: null,
        subsidizedShippingCost: '0.00',
        taxPercent: '0.00',
        otherCost: '0.00',
        targetMarginPercent: '0.00',
        createdAt: new Date(),
        activatedAt: new Date(),
      },
      operatingCosts: [],
      variants: [{ salePrice: '20000.00', unitCost: '10000.00' }],
      previousPeriodOrders: 7,
    });

    expect(result.ordersUsed).toBe(7);
    expect(result.sourceResolved).toBe('PREVIOUS_PERIOD');
  });
});
