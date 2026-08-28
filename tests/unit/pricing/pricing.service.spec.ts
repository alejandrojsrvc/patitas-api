import { PricingCalculator } from '../../../src/modules/pricing/domain/pricing-calculator';
import { PricingService } from '../../../src/modules/pricing/application/pricing.service';
import type { PricingRepository } from '../../../src/modules/pricing/domain/repositories/pricing.repository';
import type {
  PricingReview,
  PricingReviewSaveInput,
} from '../../../src/modules/pricing/domain/pricing.types';

describe('PricingService', () => {
  it('creates pending reviews for every eligible variant in a scenario', async () => {
    const activeRules = {
      id: 'rules-id',
      version: 1,
      status: 'ACTIVE' as const,
      currency: 'ARS' as const,
      fulfillmentCost: '0.00',
      packagingCost: '1500.00',
      paymentFixedCost: '0.00',
      paymentFeePercent: '6.29',
      paymentFeeVatApplies: true,
      paymentFeeVatPercent: '21.00',
      paymentFeeScheduleId: null,
      subsidizedShippingCost: '3200.00',
      taxPercent: '0.00',
      otherCost: '0.00',
      targetMarginPercent: '30.00',
      createdAt: new Date(),
      activatedAt: new Date(),
    };
    const context = {
      variantId: 'variant-id',
      variantRevision: 1,
      currentSalePrice: null,
      supplierOfferId: 'offer-id',
      supplierRevision: 1,
      supplierUnitCost: '10000.00',
    };
    const saveReviews = jest
      .fn<
        Promise<
          Array<
            Pick<
              PricingReview,
              'id' | 'variantId' | 'recommendedPrice' | 'commercialPrice'
            >
          >
        >,
        [PricingReviewSaveInput[]]
      >()
      .mockResolvedValue([
        {
          id: 'review-id',
          variantId: 'variant-id',
          recommendedPrice: '20000.00',
          commercialPrice: '20990.00',
        },
      ]);
    const repository = {
      getRules: jest
        .fn()
        .mockResolvedValue({ active: activeRules, draft: null }),
      getPricingScenarioAllocation: jest.fn().mockResolvedValue({
        scenarioId: 'scenario-id',
        fixedCostPerUnit: '100.00',
        projectedOrders: 20,
        averageItemsPerOrder: '1.00',
        paymentFeeOverrides: {
          paymentFixedCost: '0.00',
          paymentFeePercent: '3.10',
          paymentFeeVatApplies: true,
          paymentFeeVatPercent: '21.00',
          paymentFeeScheduleId: 'schedule-id',
        },
      }),
      listContextsForBulkRecalculation: jest.fn().mockResolvedValue([context]),
      saveReviews,
    } as unknown as PricingRepository;
    const service = new PricingService(repository, new PricingCalculator());

    await expect(service.recalculateAll('scenario-id')).resolves.toEqual({
      scenarioId: 'scenario-id',
      processed: 1,
      reviews: [
        {
          variantId: 'variant-id',
          pricingReviewId: 'review-id',
          recommendedPrice: '20000.00',
          commercialPrice: '20990.00',
        },
      ],
    });

    const savedInputs = saveReviews.mock.calls[0]?.[0];
    expect(savedInputs).toHaveLength(1);
    expect(savedInputs[0]?.context).toEqual(context);
    expect(savedInputs[0]?.rules).toEqual(activeRules);
    expect(savedInputs[0]?.effectiveRules).toMatchObject({
      paymentFeePercent: '3.10',
      paymentFeeVatPercent: '21.00',
    });
    expect(savedInputs[0]?.calculation.recommendedPrice).toEqual(
      expect.any(String),
    );
    expect(savedInputs[0]?.calculation.commercialPrice).toEqual(
      expect.any(String),
    );
  });
});
