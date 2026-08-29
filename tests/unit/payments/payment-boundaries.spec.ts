/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { CheckoutService } from '../../../src/modules/checkout/application/checkout.service';
import { PaymentService } from '../../../src/modules/payments/application/payment.service';
import { correlateAttempt } from '../../../src/modules/payments/infrastructure/prisma-payment.repository';
import type { PaymentWebhookResult } from '../../../src/shared/application/ports/payment-provider.interface';

describe('payment consistency boundaries', () => {
  it('keeps the guest token when external initiation fails', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue({
        status: 'DRAFT',
        paymentMethod: 'PAYWAY',
        items: [],
      }),
      confirm: jest.fn().mockResolvedValue({
        order: { id: 'order-1', paymentStatus: 'PENDING' },
        publicToken: 'guest-order-token',
        paymentRequired: true,
      }),
    };
    const payments = {
      assertMethodAvailable: jest.fn(),
      initiate: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        provider: 'payway',
        action: 'RETRY',
        paymentUrl: null,
        externalId: null,
        status: 'FAILED',
        expiresAt: null,
      }),
    };
    const service = new CheckoutService(
      repository as never,
      undefined,
      payments as unknown as PaymentService,
    );

    const result = await service.confirm(
      'checkout-1',
      {},
      { type: 'TOKENIZED_CARD', token: 'frontend-token', installments: 1 },
      'key-1',
    );

    expect(result.publicToken).toBe('guest-order-token');
    expect(result.payment?.status).toBe('FAILED');
    expect(repository.confirm).toHaveBeenCalledTimes(1);
  });

  it('does not create an order when the provider is disabled', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue({
        status: 'DRAFT',
        paymentMethod: 'PAYWAY',
        items: [],
      }),
      confirm: jest.fn(),
    };
    const payments = {
      assertMethodAvailable: jest.fn(() => {
        throw new Error('provider disabled');
      }),
    };
    const service = new CheckoutService(
      repository as never,
      undefined,
      payments as unknown as PaymentService,
    );

    await expect(
      service.confirm('checkout-1', {}, undefined, 'key-1'),
    ).rejects.toThrow('provider disabled');
    expect(repository.confirm).not.toHaveBeenCalled();
  });

  it('uses the exact external payment ID before a legacy order reference', async () => {
    const exact = { id: 'attempt-exact', orderId: 'order-1' };
    const transaction = {
      paymentAttempt: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([exact])
          .mockResolvedValueOnce([]),
      },
    };
    const event: PaymentWebhookResult = {
      externalEventId: 'event-1',
      eventType: 'payment',
      externalPaymentId: 'external-1',
      externalReference: 'order-1',
      status: 'APPROVED',
      rawPayload: {},
    };

    await expect(
      correlateAttempt(transaction as never, 'payway', event),
    ).resolves.toEqual(exact);
    expect(transaction.paymentAttempt.findMany).toHaveBeenCalledTimes(2);
  });

  it('refuses an ambiguous external reference', async () => {
    const transaction = {
      paymentAttempt: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'attempt-1' }, { id: 'attempt-2' }]),
      },
    };
    const event: PaymentWebhookResult = {
      externalEventId: 'event-1',
      eventType: 'payment',
      externalReference: 'order-1',
      status: 'APPROVED',
      rawPayload: {},
    };

    await expect(
      correlateAttempt(transaction as never, 'payway', event),
    ).resolves.toBeNull();
  });
});
