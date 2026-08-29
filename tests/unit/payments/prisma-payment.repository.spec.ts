/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/require-await */

import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import {
  PrismaPaymentRepository,
  applyWebhookResult,
} from '../../../src/modules/payments/infrastructure/prisma-payment.repository';
import { PaymentConflictError } from '../../../src/modules/payments/application/payment.service';
import type { PaymentProvider } from '../../../src/shared/application/ports/payment-provider.interface';
import type { TokenizedCardPayment } from '../../../src/shared/domain/payment.types';
import { Prisma } from '../../../src/infrastructure/database/generated/prisma/client';

const card: TokenizedCardPayment = {
  type: 'TOKENIZED_CARD',
  token: 'token-1',
  installments: 1,
  paymentMethodReference: 1,
  cardBin: '450799',
};

describe('PrismaPaymentRepository consistency', () => {
  it('does not make two external calls for concurrent initiations', async () => {
    const state = createState('PAYWAY');
    let release!: () => void;
    const external = new Promise((resolve) => {
      release = () => resolve({ status: 'pending' });
    });
    const provider = createProvider('payway');
    provider.initiatePayment = jest.fn().mockReturnValue(external);
    const repository = createRepository(state, provider);

    const first = repository.initiate('order-1', owner(), card, 'key-1');
    await waitFor(() => provider.initiatePayment.mock.calls.length === 1);
    const second = await repository.initiate('order-1', owner(), card, 'key-1');

    expect(provider.initiatePayment).toHaveBeenCalledTimes(1);
    expect(second.status).toBe('PROCESSING');
    release();
    await first;
  });

  it('returns 409-domain conflict when a key changes relevant parameters', async () => {
    const state = createState('PAYWAY');
    const provider = createProvider('payway');
    provider.initiatePayment = jest.fn().mockResolvedValue({
      provider: 'payway',
      externalId: 'payment-1',
      status: 'PENDING',
    });
    const repository = createRepository(state, provider);

    await repository.initiate('order-1', owner(), card, 'key-1');
    await expect(
      repository.initiate(
        'order-1',
        owner(),
        { ...card, installments: 3 },
        'key-1',
      ),
    ).rejects.toBeInstanceOf(PaymentConflictError);
    expect(provider.initiatePayment).toHaveBeenCalledTimes(1);
  });

  it('allows a new operation only with a new key after rejection', async () => {
    const state = createState('PAYWAY');
    const provider = createProvider('payway');
    provider.initiatePayment = jest
      .fn()
      .mockResolvedValueOnce({ provider: 'payway', status: 'REJECTED' })
      .mockResolvedValueOnce({ provider: 'payway', status: 'PENDING' });
    const repository = createRepository(state, provider);

    await repository.initiate('order-1', owner(), card, 'key-1');
    await repository.initiate(
      'order-1',
      owner(),
      { ...card, token: 'token-2' },
      'key-2',
    );

    expect(provider.initiatePayment).toHaveBeenCalledTimes(2);
  });

  it('does not regress a paid order when an older attempt is rejected', async () => {
    const order = paymentOrder('PAID', 'PAID');
    const attempt = paymentAttempt('PENDING');
    const transaction = createWebhookTransaction(order, attempt);

    await applyWebhookResult(
      transaction,
      order,
      attempt,
      {
        externalEventId: 'event-1',
        eventType: 'payment',
        externalPaymentId: 'old-payment',
        status: 'REJECTED',
        rawPayload: {},
      },
      'payway',
    );

    expect(transaction.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'PAID' }),
      }),
    );
    expect(
      transaction.order.update.mock.calls[0]?.[0].data.status,
    ).toBeUndefined();
  });

  it('creates an idempotent full refund movement', async () => {
    const order = paymentOrder('PAID', 'PAID');
    const attempt = paymentAttempt('APPROVED');
    const transaction = createWebhookTransaction(order, attempt);

    await applyWebhookResult(
      transaction,
      order,
      attempt,
      refundEvent('REFUNDED', 'refund-1', '100.00'),
      'payway',
    );

    expect(transaction.orderPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'REFUND' }),
      }),
    );
    expect(transaction.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'REFUNDED' }),
      }),
    );
  });

  it('creates a chargeback movement without regressing the order operational status', async () => {
    const order = paymentOrder('SHIPPED', 'PAID');
    const attempt = paymentAttempt('APPROVED');
    const transaction = createWebhookTransaction(order, attempt);

    await applyWebhookResult(
      transaction,
      order,
      attempt,
      refundEvent('CHARGED_BACK', 'chargeback-1', '100.00'),
      'mercadopago',
    );

    expect(transaction.orderPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'CHARGEBACK' }),
      }),
    );
    expect(
      transaction.order.update.mock.calls[0]?.[0].data.status,
    ).toBeUndefined();
    expect(transaction.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'CHARGED_BACK' }),
      }),
    );
  });

  it('keeps an approved capture idempotent when the same webhook is applied twice', async () => {
    const order = paymentOrder('PENDING_PAYMENT', 'PENDING');
    const attempt = paymentAttempt('PENDING');
    const transaction = createWebhookTransaction(order, attempt, false);
    const event = {
      externalEventId: 'event-approved',
      eventType: 'payment',
      externalPaymentId: 'payment-1',
      status: 'APPROVED' as const,
      amount: '100.00',
      currency: 'ARS',
      rawPayload: {},
    };

    await applyWebhookResult(transaction, order, attempt, event, 'payway');
    await applyWebhookResult(transaction, order, attempt, event, 'payway');

    expect(transaction.orderPayment.create).toHaveBeenCalledTimes(1);
  });

  it('marks an external over-refund for reconciliation instead of discarding it', async () => {
    const order = paymentOrder('PAID', 'PAID');
    const attempt = paymentAttempt('APPROVED');
    const transaction = createWebhookTransaction(order, attempt);

    const result = await applyWebhookResult(
      transaction,
      order,
      attempt,
      refundEvent('REFUNDED', 'refund-over', '150.00'),
      'payway',
    );

    expect(result.reconciliationRequired).toBe(true);
    expect(transaction.orderPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: '150.00' }),
      }),
    );
  });

  it('moves an approved payment to partially refunded', async () => {
    const order = paymentOrder('PAID', 'PAID');
    const attempt = paymentAttempt('APPROVED');
    const transaction = createWebhookTransaction(order, attempt);

    await applyWebhookResult(
      transaction,
      order,
      attempt,
      refundEvent('REFUNDED', 'refund-partial', '25.00'),
      'payway',
    );

    expect(transaction.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'PARTIALLY_REFUNDED' }),
      }),
    );
  });

  it('does not change the operational status for a full refund', async () => {
    const order = paymentOrder('PROCESSING', 'PAID');
    const attempt = paymentAttempt('APPROVED');
    const transaction = createWebhookTransaction(order, attempt);

    await applyWebhookResult(
      transaction,
      order,
      attempt,
      refundEvent('REFUNDED', 'refund-processing-order', '100.00'),
      'payway',
    );

    expect(
      transaction.order.update.mock.calls[0]?.[0].data.status,
    ).toBeUndefined();
  });
});

const owner = () => ({ customerId: 'customer-1' });

const createProvider = (name: 'payway' | 'mercadopago'): PaymentProvider => ({
  name,
  createExternalReference: ({ attemptId }) => `external-${attemptId}`,
  initiatePayment: jest
    .fn()
    .mockResolvedValue({ provider: name, status: 'PENDING' }),
  parseWebhook: jest.fn(),
  resolveWebhook: jest.fn(),
});

const createRepository = (
  state: ReturnType<typeof createState>,
  provider: PaymentProvider,
) =>
  new PrismaPaymentRepository(state.prisma as unknown as PrismaService, {
    resolve: () => provider,
  });

const createState = (paymentMethod: string) => {
  const order = paymentOrder('PENDING_PAYMENT', 'PENDING');
  order.paymentMethod = paymentMethod;
  const attempts: Array<Record<string, unknown>> = [];
  const payments: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    order: {
      findFirst: jest.fn().mockResolvedValue(order),
      findUnique: jest.fn().mockResolvedValue(order),
      findUniqueOrThrow: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockImplementation(({ data }) => {
        Object.assign(order, data);
        return order;
      }),
    },
    paymentAttempt: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            attempts.find(
              (item) => item.idempotencyKey === where.idempotencyKey,
            ) ?? null,
          ),
        ),
      findFirst: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            attempts.find((item) =>
              ['CREATED', 'PROCESSING', 'PENDING'].includes(
                String(item.status),
              ),
            ) ?? null,
          ),
        ),
      create: jest.fn().mockImplementation(({ data }) => {
        attempts.push(data);
        return Promise.resolve(data);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        const item = attempts.find((candidate) => candidate.id === where.id);
        if (!item || item.status !== where.status)
          return Promise.resolve({ count: 0 });
        Object.assign(item, data);
        return Promise.resolve({ count: 1 });
      }),
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(attempts.find((item) => item.id === where.id)),
        ),
    },
    orderPayment: {
      create: jest.fn().mockImplementation(({ data }) => {
        payments.push(data);
        return Promise.resolve(data);
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    paymentWebhookEvent: {
      findUniqueOrThrow: jest.fn(),
    },
  };
  return {
    prisma: {
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    },
    tx,
  };
};

const paymentOrder = (status: string, paymentStatus: string) => ({
  id: 'order-1',
  customerId: 'customer-1',
  status,
  paymentStatus,
  paymentMethod: 'PAYWAY',
  total: new Prisma.Decimal('100.00'),
  currency: 'ARS',
  contactEmail: 'buyer@example.com',
  payments: [],
});

const paymentAttempt = (status: string) => ({
  id: 'attempt-1',
  orderId: 'order-1',
  provider: 'payway',
  status,
  amount: new Prisma.Decimal('100.00'),
  currency: 'ARS',
  externalPaymentId: 'payment-1',
  externalPreferenceId: null,
  externalReference: 'external-attempt-1',
  paymentUrl: null,
  expiresAt: null,
  idempotencyKey: 'key-1',
  requestFingerprint: 'fingerprint',
  processingLeaseToken: null,
  processingLeaseUntil: null,
});

const createWebhookTransaction = (
  order: ReturnType<typeof paymentOrder>,
  attempt: ReturnType<typeof paymentAttempt>,
  withCapture = true,
) => {
  const payments = withCapture
    ? [
        {
          amount: new Prisma.Decimal('100.00'),
          kind: 'PAYMENT' as const,
          paidAt: new Date(),
          provider: 'payway',
          externalPaymentId: 'payment-1',
          paymentAttemptId: 'attempt-1',
        },
      ]
    : [];
  return {
    paymentAttempt: {
      update: jest.fn().mockResolvedValue(attempt),
    },
    orderPayment: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            payments.find(
              (payment) =>
                (where.externalOperationId &&
                  payment.externalOperationId === where.externalOperationId) ||
                (where.paymentAttemptId &&
                  payment.paymentAttemptId === where.paymentAttemptId) ||
                (where.provider &&
                  where.externalPaymentId &&
                  payment.provider === where.provider &&
                  payment.externalPaymentId === where.externalPaymentId) ||
                (where.OR &&
                  where.OR.some(
                    (condition: { paymentAttemptId?: string }) =>
                      condition.paymentAttemptId === payment.paymentAttemptId,
                  )),
            ) ?? null,
          ),
        ),
      create: jest.fn().mockImplementation(({ data }) => {
        payments.push({ ...data, paidAt: new Date() });
        return Promise.resolve(data);
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(payments)),
    },
    order: {
      update: jest.fn().mockResolvedValue(order),
    },
  } as unknown as Prisma.TransactionClient;
};

const refundEvent = (
  status: 'REFUNDED' | 'CHARGED_BACK',
  operation: string,
  amount: string,
) => ({
  externalEventId: operation,
  eventType: 'payment',
  externalPaymentId: 'payment-1',
  externalOperationId: operation,
  amount,
  currency: 'ARS',
  status,
  rawPayload: {},
});

const waitFor = async (condition: () => boolean) => {
  for (let index = 0; index < 20 && !condition(); index += 1)
    await new Promise((resolve) => setImmediate(resolve));
};
