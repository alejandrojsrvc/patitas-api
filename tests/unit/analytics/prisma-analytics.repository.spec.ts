jest.mock('../../../src/infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { PrismaAnalyticsRepository } from '../../../src/modules/analytics/infrastructure/prisma-analytics.repository';

const createRepository = (visitorInsertCount: number) => {
  const productViewDailyUpdate = jest.fn();
  const visitorUpdate = jest.fn<
    void,
    [
      {
        where: {
          productId_viewDate_visitorHash: {
            productId: string;
            viewDate: Date;
            visitorHash: string;
          };
        };
        data: { lastViewedAt: Date };
      },
    ]
  >();
  const transaction = {
    product: {
      findFirst: jest.fn().mockResolvedValue({ id: 'product-id' }),
    },
    productViewDaily: {
      upsert: jest.fn(),
      update: productViewDailyUpdate,
    },
    productViewVisitorDaily: {
      createMany: jest.fn().mockResolvedValue({ count: visitorInsertCount }),
      update: visitorUpdate,
    },
    recentProductView: {
      upsert: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (value: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };

  return {
    repository: new PrismaAnalyticsRepository(prisma as never),
    transaction,
    productViewDailyUpdate,
    visitorUpdate,
  };
};

describe('PrismaAnalyticsRepository', () => {
  it('counts the first visit as unique without throwing on duplicates', async () => {
    const { repository, transaction, productViewDailyUpdate, visitorUpdate } =
      createRepository(1);

    await expect(
      repository.recordProductView('producto', 'visitor-hash'),
    ).resolves.toBeUndefined();

    expect(transaction.productViewVisitorDaily.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(productViewDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { uniqueViews: { increment: 1 } },
      }),
    );
    expect(visitorUpdate).not.toHaveBeenCalled();
  });

  it('updates a repeated visitor without incrementing unique views', async () => {
    const { repository, transaction, productViewDailyUpdate, visitorUpdate } =
      createRepository(0);

    await expect(
      repository.recordProductView('producto', 'visitor-hash'),
    ).resolves.toBeUndefined();

    expect(transaction.productViewVisitorDaily.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(visitorUpdate).toHaveBeenCalledTimes(1);
    const updateInput = visitorUpdate.mock.calls[0][0];
    expect(updateInput.data.lastViewedAt).toBeInstanceOf(Date);
    expect(productViewDailyUpdate).not.toHaveBeenCalled();
  });
});
