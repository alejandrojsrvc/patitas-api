jest.mock('../../../src/infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { PrismaPricingRepository } from '../../../src/modules/pricing/infrastructure/persistence/prisma-pricing.repository';
import type { PricingScenarioAnalysis } from '../../../src/modules/pricing/domain/pricing.types';

describe('PrismaPricingRepository', () => {
  it('keeps payment fee overrides at calculation precision', async () => {
    const repository = new PrismaPricingRepository({} as never, {} as never);
    const analysis = {
      ordersUsed: 20,
      fixedMonthlyCosts: '100.00',
      scenario: { averageItemsPerOrder: '1.00' },
      paymentFeeSchedule: {
        id: 'schedule-id',
        feePercent: '3.10',
        vatApplies: true,
        vatPercent: '21.00',
        fixedFee: '0.00',
      },
      costBreakdown: {
        rules: {
          paymentFixed: '0.00',
          paymentFeePercent: '3.1000',
          paymentFeeVatApplies: true,
          paymentFeeVatPercent: '21.0000',
        },
      },
    } as unknown as PricingScenarioAnalysis;
    jest
      .spyOn(repository, 'analyzePricingScenario')
      .mockResolvedValue(analysis);

    await expect(
      repository.getPricingScenarioAllocation('scenario-id'),
    ).resolves.toMatchObject({
      paymentFeeOverrides: {
        paymentFixedCost: '0.00',
        paymentFeePercent: '3.10',
        paymentFeeVatApplies: true,
        paymentFeeVatPercent: '21.00',
        paymentFeeScheduleId: 'schedule-id',
      },
    });
  });
});
