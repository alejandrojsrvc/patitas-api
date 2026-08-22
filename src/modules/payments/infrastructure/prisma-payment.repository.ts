import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import type {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
} from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PaymentWebhookResult,
} from '../../../shared/application/ports/payment-provider.interface';
import { PaymentValidationError } from '../application/payment.service';
import type {
  PaymentLink,
  PaymentOwner,
  PaymentRepository,
} from '../domain/payment.repository';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  public constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  public async createLink(
    orderId: string,
    owner: PaymentOwner,
  ): Promise<PaymentLink> {
    if (!owner.customerId && !owner.publicTokenHash)
      throw new PaymentValidationError(
        'Se requiere autenticación o X-Order-Token.',
      );
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(owner.customerId
          ? { customerId: owner.customerId }
          : { publicAccessTokenHash: owner.publicTokenHash }),
      },
      include: { lines: true },
    });
    if (!order)
      throw new PaymentValidationError(
        'El pedido no existe o no tienes acceso.',
      );
    if (order.paymentStatus === 'PAID')
      throw new PaymentValidationError('El pedido ya está pagado.');
    if (order.status !== 'PENDING_PAYMENT')
      throw new PaymentValidationError(
        'El pedido no tiene un pago pendiente reintentable.',
      );
    const latest = await this.prisma.paymentAttempt.findFirst({
      where: {
        orderId,
        status: { in: ['CREATED', 'PENDING'] },
        paymentUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest?.paymentUrl &&
      (!latest.expiresAt || latest.expiresAt > new Date())
    )
      return mapLink(latest);

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const result = await this.provider.createPaymentLink({
      orderId,
      title: `Pedido Patitas ${orderId.slice(0, 8)}`,
      amount: order.total.toString(),
      currency: order.currency,
      payerEmail: order.contactEmail,
      externalReference: orderId,
      expiresAt,
    });
    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        orderId,
        provider: result.provider,
        externalPreferenceId: result.preferenceId ?? null,
        status: 'PENDING',
        amount: order.total,
        currency: order.currency,
        paymentUrl: result.paymentUrl,
        idempotencyKey: `${result.provider}:${orderId}:${expiresAt.getTime()}`,
        expiresAt: result.expiresAt ?? expiresAt,
        rawResponse: result.rawResponse ?? undefined,
      },
    });
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        paymentProvider: result.provider,
        paymentExpiresAt: result.expiresAt ?? expiresAt,
      },
    });
    return mapLink({ ...attempt, status: 'PENDING' });
  }

  public async handleWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }) {
    const event = await this.provider.parseWebhook(input);
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: this.provider.name,
          externalId: event.externalEventId,
          eventType: event.eventType,
          payload: event.rawPayload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return { accepted: true, duplicate: true };
      throw error;
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider: this.provider.name,
        OR: [
          { externalPaymentId: event.externalPaymentId ?? '__missing__' },
          { orderId: event.externalReference ?? '__missing__' },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!attempt) {
      await this.prisma.paymentWebhookEvent.updateMany({
        where: {
          provider: this.provider.name,
          externalId: event.externalEventId,
        },
        data: {
          status: 'IGNORED',
          processedAt: new Date(),
          error: 'No se encontró intento de pago.',
        },
      });
      return { accepted: true, duplicate: false };
    }
    const mapped = (
      {
        APPROVED: {
          paymentStatus: 'PAID',
          status: 'PAID',
          attempt: 'APPROVED',
        },
        PENDING: {
          paymentStatus: 'PENDING',
          status: 'PENDING_PAYMENT',
          attempt: 'PENDING',
        },
        REJECTED: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
          attempt: 'REJECTED',
        },
        CANCELLED: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
          attempt: 'CANCELLED',
        },
        EXPIRED: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
          attempt: 'EXPIRED',
        },
        FAILED: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
          attempt: 'FAILED',
        },
      } satisfies Record<
        PaymentWebhookResult['status'],
        {
          paymentStatus: PaymentStatus;
          status: OrderStatus;
          attempt: PaymentAttemptStatus;
        }
      >
    )[event.status];
    await this.prisma.$transaction(async (transaction) => {
      await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          externalPaymentId:
            event.externalPaymentId ?? attempt.externalPaymentId,
          status: mapped.attempt,
          rawResponse: event.rawPayload as Prisma.InputJsonValue,
        },
      });
      await transaction.order.update({
        where: { id: attempt.orderId },
        data: {
          paymentStatus: mapped.paymentStatus,
          status: mapped.status,
          paymentExternalId:
            event.externalPaymentId ?? attempt.externalPaymentId,
        },
      });
      if (mapped.paymentStatus === 'PAID' && attempt.status !== 'APPROVED')
        await transaction.orderPayment.create({
          data: {
            orderId: attempt.orderId,
            amount: attempt.amount,
            method: this.provider.name,
            reference:
              event.externalPaymentId ??
              attempt.externalPaymentId ??
              attempt.id,
            paidAt: new Date(),
          },
        });
      if (mapped.paymentStatus === 'FAILED') {
        const lines = await transaction.orderLine.findMany({
          where: { orderId: attempt.orderId },
        });
        for (const line of lines) {
          await transaction.inventoryItem.updateMany({
            where: { variantId: line.variantId },
            data: { reserved: { decrement: line.quantity } },
          });
          await transaction.inventoryMovement.create({
            data: {
              variantId: line.variantId,
              orderId: attempt.orderId,
              type: 'RELEASE',
              quantity: line.quantity,
              reason: 'Pago externo rechazado o expirado',
            },
          });
        }
      }
      await transaction.paymentWebhookEvent.updateMany({
        where: {
          provider: this.provider.name,
          externalId: event.externalEventId,
        },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
    });
    return {
      accepted: true,
      duplicate: false,
      orderId: attempt.orderId,
      status: event.status,
      value: attempt.amount?.toString(),
    };
  }
}

const mapLink = (
  value: Prisma.PaymentAttemptGetPayload<Prisma.PaymentAttemptDefaultArgs>,
): PaymentLink => {
  if (!value.paymentUrl)
    throw new PaymentValidationError('El intento de pago no tiene URL.');
  return {
    orderId: value.orderId,
    provider: value.provider,
    paymentUrl: value.paymentUrl,
    preferenceId: value.externalPreferenceId ?? null,
    status: value.status,
    expiresAt: value.expiresAt ?? null,
  };
};
