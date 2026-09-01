/* eslint-disable @typescript-eslint/require-await */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/infrastructure/database/generated/prisma/client';
import { PrismaCheckoutHandoffRepository } from '../../src/modules/checkout/infrastructure/prisma-checkout-handoff.repository';
import { PrismaCheckoutRepository } from '../../src/modules/checkout/infrastructure/prisma-checkout.repository';
import { hashAnonymousToken } from '../../src/shared/application/anonymous-token';
import { PrismaOrderRepository } from '../../src/modules/orders/infrastructure/prisma-order.repository';
import {
  applyWebhookResult,
  PrismaPaymentRepository,
} from '../../src/modules/payments/infrastructure/prisma-payment.repository';
import type { PaymentProvider } from '../../src/shared/application/ports/payment-provider.interface';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

describe('checkout and payment database invariants', () => {
  afterAll(async () => prisma.$disconnect());

  it('rejects an empty cart during confirmation', async () => {
    const fixture = await createFixture({
      productStatus: 'ACTIVE',
      withItem: false,
    });
    const repository = new PrismaCheckoutRepository(prisma as never);
    try {
      await expect(
        repository.confirm(fixture.sessionId, {
          tokenHash: fixture.checkoutTokenHash,
        }),
      ).rejects.toThrow('carrito está vacío');
      expect(await prisma.order.count({ where: { id: fixture.orderId } })).toBe(
        0,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('rejects a variant whose product is no longer active', async () => {
    const fixture = await createFixture({
      productStatus: 'ARCHIVED',
      withItem: true,
    });
    const repository = new PrismaCheckoutRepository(prisma as never);

    try {
      await expect(
        repository.confirm(fixture.sessionId, {
          tokenHash: fixture.checkoutTokenHash,
        }),
      ).rejects.toThrow('variante dejó de estar disponible');
      expect(await prisma.order.count({ where: { id: fixture.orderId } })).toBe(
        0,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('allows only one concurrent handoff consumer', async () => {
    const fixture = await createFixture({
      productStatus: 'ACTIVE',
      withItem: false,
    });
    const token = `handoff-${randomUUID()}`;
    const repository = new PrismaCheckoutHandoffRepository(prisma as never);
    try {
      await repository.create(fixture.cartId, hashAnonymousToken(token), token);
      const results = await Promise.allSettled([
        repository.consume(hashAnonymousToken(token)),
        repository.consume(hashAnonymousToken(token)),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('expires a pending reservation exactly once and releases stock', async () => {
    const fixture = await createFixture({
      productStatus: 'ACTIVE',
      withItem: false,
    });
    const orderId = randomUUID();
    await prisma.order.create({
      data: {
        id: orderId,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        paymentMethod: 'PAYWAY',
        currency: 'ARS',
        subtotal: '10.00',
        total: '10.00',
        contactName: 'Test Buyer',
        contactEmail: 'test@example.com',
        shippingAddress: {},
        reservationExpiresAt: new Date(Date.now() - 1_000),
        lines: {
          create: {
            id: randomUUID(),
            variantId: fixture.variantId,
            productName: 'Test Product',
            sku: 'TEST-SKU',
            presentation: 'Unit',
            unitPrice: '10.00',
            quantity: 1,
            lineTotal: '10.00',
          },
        },
      },
    });
    await prisma.inventoryItem.update({
      where: { variantId: fixture.variantId },
      data: { reserved: 1 },
    });
    await prisma.inventoryMovement.create({
      data: {
        id: randomUUID(),
        variantId: fixture.variantId,
        orderId,
        type: 'RESERVE',
        quantity: 1,
        reason: 'integration test',
      },
    });

    const repository = new PrismaOrderRepository(prisma as never);
    try {
      await expect(repository.expirePaymentReservations()).resolves.toEqual({
        expired: 1,
      });
      await expect(repository.expirePaymentReservations()).resolves.toEqual({
        expired: 0,
      });
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      const inventory = await prisma.inventoryItem.findUnique({
        where: { variantId: fixture.variantId },
      });
      expect(order?.status).toBe('CANCELLED');
      expect(order?.reservationReleasedAt).not.toBeNull();
      expect(inventory?.reserved).toBe(0);
      await prisma.order.delete({ where: { id: orderId } });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('keeps an amount mismatch in reconciliation and makes the capture idempotent', async () => {
    const fixture = await createFixture({
      productStatus: 'ACTIVE',
      withItem: false,
    });
    const orderId = randomUUID();
    const attemptId = randomUUID();
    const externalPaymentId = `payment-${randomUUID()}`;
    await prisma.order.create({
      data: {
        id: orderId,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        paymentMethod: 'PAYWAY',
        paymentProvider: 'payway',
        currency: 'ARS',
        subtotal: '10.00',
        total: '10.00',
        contactName: 'Test Buyer',
        contactEmail: 'test@example.com',
        shippingAddress: {},
        reservationExpiresAt: new Date(Date.now() + 60_000),
        paymentAttempts: {
          create: {
            id: attemptId,
            provider: 'payway',
            externalPaymentId,
            status: 'PENDING',
            amount: '10.00',
            currency: 'ARS',
            idempotencyKey: `key-${attemptId}`,
            requestFingerprint: 'fingerprint',
          },
        },
      },
    });
    const event = {
      externalEventId: `event-${randomUUID()}`,
      eventType: 'payment',
      externalPaymentId,
      status: 'APPROVED' as const,
      amount: '9.00',
      currency: 'ARS',
      rawPayload: {},
    };
    const apply = async () =>
      prisma.$transaction(async (transaction) => {
        const order = await transaction.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { payments: true },
        });
        const attempt = await transaction.paymentAttempt.findUniqueOrThrow({
          where: { id: attemptId },
        });
        return applyWebhookResult(transaction, order, attempt, event, 'payway');
      });

    await apply();
    await apply();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const payments = await prisma.orderPayment.findMany({ where: { orderId } });
    expect(order?.paymentStatus).toBe('PROCESSING');
    expect(order?.reconciliationRequired).toBe(true);
    expect(order?.status).toBe('PENDING_PAYMENT');
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amount.toString()).toBe('9');
    await prisma.order.delete({ where: { id: orderId } });
    await cleanupFixture(fixture);
  });

  it('executes a refund outside the transaction and deduplicates its movement', async () => {
    const orderId = randomUUID();
    const attemptId = randomUUID();
    const paymentId = `payment-${randomUUID()}`;
    await prisma.order.create({
      data: {
        id: orderId,
        status: 'PAID',
        paymentStatus: 'PAID',
        paymentMethod: 'PAYWAY',
        paymentProvider: 'payway',
        paymentExternalId: paymentId,
        currency: 'ARS',
        subtotal: '10.00',
        total: '10.00',
        contactName: 'Test Buyer',
        contactEmail: 'test@example.com',
        shippingAddress: {},
        paymentAttempts: {
          create: {
            id: attemptId,
            provider: 'payway',
            externalPaymentId: paymentId,
            status: 'APPROVED',
            amount: '10.00',
            currency: 'ARS',
            idempotencyKey: `key-${attemptId}`,
            requestFingerprint: 'fingerprint',
          },
        },
        payments: {
          create: {
            id: randomUUID(),
            amount: '10.00',
            currency: 'ARS',
            kind: 'PAYMENT',
            provider: 'payway',
            externalPaymentId: paymentId,
            method: 'payway',
            reference: paymentId,
            paidAt: new Date(),
          },
        },
      },
    });
    const provider: PaymentProvider = {
      name: 'payway',
      createExternalReference: () => 'unused',
      initiatePayment: async () => ({ provider: 'payway', status: 'PENDING' }),
      refundPayment: async () => ({
        status: 'REFUNDED',
        externalOperationId: 'refund-operation-1',
      }),
      parseWebhook: async () => {
        throw new Error('unused');
      },
      resolveWebhook: async () => {
        throw new Error('unused');
      },
    };
    const repository = new PrismaPaymentRepository(prisma as never, {
      resolve: () => provider,
    });
    const first = await repository.refund(
      orderId,
      { admin: true },
      '4.00',
      'refund-key-1',
    );
    const second = await repository.refund(
      orderId,
      { admin: true },
      '4.00',
      'refund-key-1',
    );
    const movements = await prisma.orderPayment.findMany({
      where: { orderId, kind: 'REFUND' },
    });
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });
    expect(first.status).toBe('REFUNDED');
    expect(second.id).toBe(first.id);
    expect(movements).toHaveLength(1);
    expect(updatedOrder?.paymentStatus).toBe('PARTIALLY_REFUNDED');
    await prisma.order.delete({ where: { id: orderId } });
  });
});

type Fixture = {
  brandId: string;
  productId: string;
  variantId: string;
  inventoryId: string;
  shippingOptionId: string;
  cartId: string;
  sessionId: string;
  checkoutTokenHash: string;
  orderId: string;
};

const createFixture = async (input: {
  productStatus: 'ACTIVE' | 'ARCHIVED';
  withItem: boolean;
}): Promise<Fixture> => {
  const brandId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  const inventoryId = randomUUID();
  const cartId = randomUUID();
  const sessionId = randomUUID();
  const checkoutTokenHash = hashAnonymousToken(`checkout-${sessionId}`);
  const orderId = randomUUID();
  const shippingOptionId = randomUUID();
  await prisma.brand.create({
    data: { id: brandId, name: `Test ${brandId}`, slug: brandId },
  });
  await prisma.product.create({
    data: {
      id: productId,
      name: 'Test Product',
      slug: productId,
      brandId,
      status: input.productStatus,
    },
  });
  await prisma.productVariant.create({
    data: {
      id: variantId,
      productId,
      sku: `SKU-${variantId}`,
      presentation: 'Unit',
      salePrice: '10.00',
      active: true,
    },
  });
  await prisma.inventoryItem.create({
    data: { id: inventoryId, variantId, onHand: 5, reserved: 0 },
  });
  await prisma.shippingOption.create({
    data: {
      id: shippingOptionId,
      name: `Test Shipping ${shippingOptionId}`,
      cost: '0.00',
    },
  });
  await prisma.cart.create({
    data: {
      id: cartId,
      anonymousTokenHash: hashAnonymousToken(`cart-${cartId}`),
      items: input.withItem
        ? { create: { id: randomUUID(), variantId, quantity: 1 } }
        : undefined,
    },
  });
  await prisma.checkoutSession.create({
    data: {
      id: sessionId,
      cartId,
      accessTokenHash: checkoutTokenHash,
      contactName: 'Test Buyer',
      contactEmail: 'test@example.com',
      shippingAddress: {
        street: 'Test Street',
        number: '1',
        city: 'Buenos Aires',
        province: 'Buenos Aires',
        postalCode: '1000',
      },
      paymentMethod: 'SIMULATED_CARD',
      shippingOptionId,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return {
    brandId,
    productId,
    variantId,
    inventoryId,
    shippingOptionId,
    cartId,
    sessionId,
    checkoutTokenHash,
    orderId,
  };
};

const cleanupFixture = async (fixture: Fixture) => {
  await prisma.checkoutSession.deleteMany({ where: { id: fixture.sessionId } });
  await prisma.cart.deleteMany({ where: { id: fixture.cartId } });
  await prisma.inventoryItem.deleteMany({ where: { id: fixture.inventoryId } });
  await prisma.shippingOption.deleteMany({
    where: { id: fixture.shippingOptionId },
  });
  await prisma.inventoryMovement.deleteMany({
    where: { variantId: fixture.variantId },
  });
  await prisma.productVariant.deleteMany({ where: { id: fixture.variantId } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.brand.deleteMany({ where: { id: fixture.brandId } });
};
