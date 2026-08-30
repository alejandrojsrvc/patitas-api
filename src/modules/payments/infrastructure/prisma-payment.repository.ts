import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import type {
  OrderPaymentKind,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
} from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  PAYMENT_PROVIDER_RESOLVER,
  type NormalizedPaymentStatus,
  type PaymentProviderName,
  type PaymentProviderResolver,
  type PaymentWebhookReceipt,
  type PaymentWebhookResult,
  type PaymentInitiationResult,
  type PaymentRefundResult,
} from '../../../shared/application/ports/payment-provider.interface';
import {
  PaymentConflictError,
  PaymentValidationError,
} from '../application/payment.service';
import type {
  PaymentInitiation,
  PaymentOwner,
  PaymentRepository,
  PaymentRefund,
} from '../domain/payment.repository';
import type { TokenizedCardPayment } from '../../../shared/domain/payment.types';
import {
  PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
  type PaymentProviderConfigurationRepository,
} from '../domain/payment-provider-configuration.repository';

const ACTIVE_ATTEMPTS: PaymentAttemptStatus[] = [
  'CREATED',
  'PROCESSING',
  'PENDING',
];
const FINAL_ORDER_PAYMENT_STATUSES: PaymentStatus[] = [
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'CHARGED_BACK',
];
const LEASE_MS = 30_000;
const WEBHOOK_LEASE_MS = 60_000;

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  public constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_RESOLVER)
    private readonly providers: PaymentProviderResolver,
    @Optional()
    @Inject(PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY)
    private readonly configurations?: PaymentProviderConfigurationRepository,
  ) {}

  public async initiate(
    orderId: string,
    owner: PaymentOwner,
    paymentMethod?: TokenizedCardPayment,
    requestedIdempotencyKey?: string,
  ): Promise<PaymentInitiation> {
    if (!owner.customerId && !owner.publicTokenHash)
      throw new PaymentValidationError(
        'Se requiere autenticación o X-Order-Token.',
      );
    if (!requestedIdempotencyKey?.trim())
      throw new PaymentValidationError(
        'Idempotency-Key es obligatorio para iniciar un pago.',
      );

    const prepared = await this.prisma.$transaction(async (transaction) => {
      await lockOrder(transaction, orderId);
      const order = await transaction.order.findFirst({
        where: {
          id: orderId,
          ...paymentOwnerWhere(owner),
        },
        include: { lines: true },
      });
      if (!order)
        throw new PaymentValidationError(
          'El pedido no existe o no tienes acceso.',
        );
      if (
        order.reservationExpiresAt &&
        order.reservationExpiresAt <= new Date() &&
        !FINAL_ORDER_PAYMENT_STATUSES.includes(order.paymentStatus)
      )
        throw new PaymentValidationError(
          'La reserva del pedido expiró y requiere revisión.',
        );
      if (order.reconciliationRequired)
        throw new PaymentConflictError(
          'El pedido requiere conciliación manual antes de reintentar el pago.',
        );

      const providerName = providerForMethod(order.paymentMethod);
      if (
        this.configurations &&
        !(await this.configurations.isEnabled(providerName))
      )
        throw new PaymentValidationError(
          `La pasarela ${providerName} está deshabilitada en la configuración de pagos.`,
        );
      const provider = this.providers.resolve(providerName);
      if (providerName === 'payway' && !paymentMethod)
        throw new PaymentValidationError(
          'Payway requiere el token de tarjeta generado por el frontend.',
        );

      const idempotencyKey =
        requestedIdempotencyKey?.trim() ||
        `${providerName}:${orderId}:${randomUUID()}`;
      const fingerprint = requestFingerprint({
        orderId,
        provider: providerName,
        amount: order.total.toString(),
        currency: order.currency,
        paymentMethod,
      });
      const existing = await transaction.paymentAttempt.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint)
          throw new PaymentConflictError(
            'La Idempotency-Key ya fue utilizada con parámetros diferentes.',
          );
        if (existing.orderId !== orderId || existing.provider !== providerName)
          throw new PaymentConflictError(
            'La Idempotency-Key ya fue utilizada para otra operación.',
          );
        if (
          existing.status === 'PROCESSING' &&
          existing.processingLeaseUntil &&
          existing.processingLeaseUntil <= new Date()
        ) {
          const leaseToken = randomUUID();
          const claimed = await transaction.paymentAttempt.updateMany({
            where: {
              id: existing.id,
              status: 'PROCESSING',
              processingLeaseUntil: { lte: new Date() },
            },
            data: {
              processingLeaseToken: leaseToken,
              processingLeaseUntil: new Date(Date.now() + LEASE_MS),
              attemptCount: { increment: 1 },
              lastError: null,
            },
          });
          if (claimed.count === 1)
            return {
              order,
              provider,
              attempt: {
                ...existing,
                processingLeaseToken: leaseToken,
                processingLeaseUntil: new Date(Date.now() + LEASE_MS),
              },
              shouldCall: true,
            };
        }
        return { order, provider, attempt: existing, shouldCall: false };
      }

      if (order.paymentStatus === 'PAID')
        throw new PaymentValidationError('El pedido ya está pagado.');
      if (!['PENDING_PAYMENT', 'PAID'].includes(order.status))
        throw new PaymentValidationError(
          'El pedido no tiene un pago pendiente reintentable.',
        );

      const active = await transaction.paymentAttempt.findFirst({
        where: {
          orderId,
          provider: providerName,
          status: { in: ACTIVE_ATTEMPTS },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (active)
        throw new PaymentConflictError(
          'El pedido ya tiene un intento de pago activo. Usa su Idempotency-Key o espera su resultado.',
        );

      const attemptId = randomUUID();
      const leaseToken = randomUUID();
      const leaseUntil = new Date(Date.now() + LEASE_MS);
      const externalReference = provider.createExternalReference({
        orderId,
        attemptId,
      });
      const attempt = await transaction.paymentAttempt.create({
        data: {
          id: attemptId,
          orderId,
          provider: providerName,
          externalReference,
          status: 'PROCESSING',
          amount: order.total,
          currency: order.currency,
          idempotencyKey,
          requestFingerprint: fingerprint,
          processingLeaseToken: leaseToken,
          processingLeaseUntil: leaseUntil,
          attemptCount: 1,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });
      return { order, provider, attempt, shouldCall: true };
    });

    if (!prepared.shouldCall) {
      const currentOrder = this.prisma.order
        ? await this.prisma.order.findUniqueOrThrow({
            where: { id: orderId },
            select: {
              paymentStatus: true,
              reconciliationRequired: true,
              reservationExpiresAt: true,
            },
          })
        : undefined;
      return mapInitiation(
        prepared.attempt,
        attemptStatusToNormalized(prepared.attempt.status),
        currentOrder,
      );
    }

    let result: PaymentInitiationResult;
    try {
      result = await prepared.provider.initiatePayment({
        attemptId: prepared.attempt.id,
        orderId,
        title: `Pedido Patitas ${orderId.slice(0, 8)}`,
        amount: prepared.order.total.toString(),
        currency: prepared.order.currency,
        payerEmail: prepared.order.contactEmail,
        externalReference: prepared.attempt.externalReference!,
        idempotencyKey: prepared.attempt.idempotencyKey,
        expiresAt: prepared.attempt.expiresAt ?? undefined,
        paymentMethod,
      });
    } catch (error) {
      await this.prisma.paymentAttempt.updateMany({
        where: {
          id: prepared.attempt.id,
          status: 'PROCESSING',
          processingLeaseToken: prepared.attempt.processingLeaseToken,
        },
        data: {
          status: 'FAILED',
          processingLeaseToken: null,
          processingLeaseUntil: null,
          lastError: safeError(error),
        },
      });
      const failed = await this.prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: prepared.attempt.id },
      });
      const currentOrder = this.prisma.order
        ? await this.prisma.order.findUniqueOrThrow({
            where: { id: orderId },
            select: {
              paymentStatus: true,
              reconciliationRequired: true,
              reservationExpiresAt: true,
            },
          })
        : undefined;
      return mapInitiation(failed, 'FAILED', currentOrder);
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      await lockOrder(transaction, orderId);
      const updatedCount = await transaction.paymentAttempt.updateMany({
        where: {
          id: prepared.attempt.id,
          status: 'PROCESSING',
          processingLeaseToken: prepared.attempt.processingLeaseToken,
        },
        data: {
          externalPreferenceId: result.externalId ?? null,
          externalPaymentId:
            prepared.provider.name === 'payway'
              ? (result.externalId ?? null)
              : null,
          status: attemptStatus(result.status),
          paymentUrl: result.paymentUrl ?? null,
          expiresAt: result.expiresAt ?? prepared.attempt.expiresAt,
          rawResponse: result.rawResponse as Prisma.InputJsonValue,
          processingLeaseToken: null,
          processingLeaseUntil: null,
          lastError: null,
        },
      });
      if (updatedCount.count !== 1)
        return transaction.paymentAttempt.findUniqueOrThrow({
          where: { id: prepared.attempt.id },
        });
      const attempt = await transaction.paymentAttempt.findUniqueOrThrow({
        where: { id: prepared.attempt.id },
      });
      await applyInitiationToOrder(transaction, attempt, result);
      return attempt;
    });
    const currentOrder = this.prisma.order
      ? await this.prisma.order.findUniqueOrThrow({
          where: { id: orderId },
          select: {
            paymentStatus: true,
            reconciliationRequired: true,
            reservationExpiresAt: true,
          },
        })
      : undefined;
    return mapInitiation(updated, result.status, currentOrder);
  }

  public async refund(
    orderId: string,
    owner: PaymentOwner,
    requestedAmount: string | undefined,
    idempotencyKey: string,
  ): Promise<PaymentRefund> {
    if (!owner.admin && !owner.customerId && !owner.publicTokenHash)
      throw new PaymentValidationError(
        'Se requiere autenticación o X-Order-Token.',
      );
    const prepared = await this.prisma.$transaction(async (transaction) => {
      await lockOrder(transaction, orderId);
      const order = await transaction.order.findFirst({
        where: {
          id: orderId,
          ...paymentOwnerWhere(owner),
        },
        include: {
          payments: true,
          paymentAttempts: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!order)
        throw new PaymentValidationError(
          'El pedido no existe o no tienes acceso.',
        );
      const existing = await transaction.paymentRefund.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return { existing, provider: null };
      const captured = sumPayments(order.payments, 'PAYMENT');
      const refunded = sumPayments(order.payments, 'REFUND');
      const chargedBack = sumPayments(order.payments, 'CHARGEBACK');
      const available = captured - refunded - chargedBack;
      if (available <= 0n)
        throw new PaymentValidationError(
          'El pedido no tiene saldo reembolsable.',
        );
      const amount = requestedAmount ? cents(requestedAmount) : available;
      if (amount <= 0n || amount > available)
        throw new PaymentValidationError(
          'El importe del refund supera el saldo disponible.',
        );
      const attempt = order.paymentAttempts.find(
        (candidate) =>
          candidate.status === 'APPROVED' && candidate.externalPaymentId,
      );
      const externalPaymentId =
        attempt?.externalPaymentId ?? order.paymentExternalId;
      if (!externalPaymentId)
        throw new PaymentValidationError(
          'El pedido no tiene un identificador externo reembolsable.',
        );
      const providerName = (attempt?.provider ??
        order.paymentProvider) as PaymentProviderName;
      if (!providerName)
        throw new PaymentValidationError(
          'El pedido no tiene una pasarela de pago.',
        );
      const provider = this.providers.resolve(providerName);
      const refund = await transaction.paymentRefund.create({
        data: {
          id: randomUUID(),
          orderId,
          paymentAttemptId: attempt?.id,
          provider: providerName,
          externalPaymentId,
          amount: amountFromCents(amount),
          currency: order.currency,
          idempotencyKey,
          status: 'PROCESSING',
        },
      });
      return { refund, provider };
    });
    if (prepared.provider === null) return mapRefund(prepared.existing);

    let result: PaymentRefundResult;
    try {
      result = await prepared.provider.refundPayment({
        paymentId: prepared.refund.externalPaymentId,
        amount: prepared.refund.amount.toString(),
        currency: prepared.refund.currency,
        idempotencyKey,
      });
    } catch (error) {
      result = { status: 'FAILED', rawResponse: { error: safeError(error) } };
    }
    const updated = await this.prisma.$transaction(async (transaction) => {
      const refund = await transaction.paymentRefund.update({
        where: { id: prepared.refund.id },
        data: {
          status: result.status,
          externalOperationId: result.externalOperationId,
          failureReason:
            result.status === 'FAILED'
              ? 'El provider rechazó el refund.'
              : null,
          rawResponse: result.rawResponse as Prisma.InputJsonValue,
        },
      });
      if (result.status === 'REFUNDED') {
        const operationId = result.externalOperationId ?? refund.id;
        const movement = await transaction.orderPayment.findFirst({
          where: {
            provider: refund.provider,
            externalOperationId: operationId,
          },
        });
        if (!movement) {
          await transaction.orderPayment.create({
            data: {
              id: randomUUID(),
              orderId: refund.orderId,
              paymentAttemptId: refund.paymentAttemptId,
              amount: refund.amount,
              currency: refund.currency,
              kind: 'REFUND',
              provider: refund.provider,
              externalPaymentId: refund.externalPaymentId,
              externalOperationId: operationId,
              method: refund.provider,
              reference: operationId,
              paidAt: new Date(),
            },
          });
        }
        const payments = await transaction.orderPayment.findMany({
          where: { orderId: refund.orderId, paidAt: { not: null } },
        });
        const captured = sumPayments(payments, 'PAYMENT');
        const totalRefunded = sumPayments(payments, 'REFUND');
        await transaction.order.update({
          where: { id: refund.orderId },
          data: {
            paymentStatus:
              totalRefunded >= captured ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          },
        });
      }
      return refund;
    });
    return mapRefund(updated);
  }

  public async status(
    orderId: string,
    owner: PaymentOwner,
  ): Promise<PaymentInitiation> {
    if (!owner.admin && !owner.customerId && !owner.publicTokenHash)
      throw new PaymentValidationError(
        'Se requiere autenticación o X-Order-Token.',
      );
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...paymentOwnerWhere(owner),
      },
      select: {
        paymentStatus: true,
        reconciliationRequired: true,
        reservationExpiresAt: true,
        paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const attempt = order?.paymentAttempts[0];
    if (!order || !attempt)
      throw new PaymentValidationError('El pago no existe o no tienes acceso.');
    return mapInitiation(
      attempt,
      attemptStatusToNormalized(attempt.status),
      order,
    );
  }

  public async handleWebhook(input: {
    provider: PaymentProviderName;
    receipt: PaymentWebhookReceipt;
  }) {
    const provider = this.providers.resolve(input.provider);
    const event = await this.getOrCreateWebhookEvent(
      provider.name,
      input.receipt,
    );
    if (event.status === 'PROCESSED' || event.status === 'IGNORED')
      return { accepted: true, duplicate: true };

    const claimed = await this.claimWebhook(event.id);
    if (!claimed)
      return { accepted: true, duplicate: false, status: 'PROCESSING' };

    let resolved: PaymentWebhookResult;
    try {
      resolved = await provider.resolveWebhook(input.receipt);
    } catch (error) {
      await this.markWebhookFailed(event.id, safeError(error));
      throw error;
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const lockedEvent = await lockWebhook(transaction, event.id);
        const attempt = await correlateAttempt(
          transaction,
          provider.name,
          resolved,
        );
        if (!attempt) {
          await transaction.paymentWebhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              externalPaymentId: resolved.externalPaymentId,
              externalReference: resolved.externalReference,
              payload: resolved.rawPayload as Prisma.InputJsonValue,
              error: 'No existe un intento único para el webhook.',
            },
          });
          return { accepted: true, duplicate: false, status: 'FAILED' };
        }
        await lockOrder(transaction, attempt.orderId);
        await lockAttempt(transaction, attempt.id);
        const currentAttempt =
          await transaction.paymentAttempt.findUniqueOrThrow({
            where: { id: attempt.id },
          });
        const order = await transaction.order.findUniqueOrThrow({
          where: { id: attempt.orderId },
          include: { payments: true },
        });
        const financial = await applyWebhookResult(
          transaction,
          order,
          currentAttempt,
          resolved,
          provider.name,
        );
        await transaction.paymentWebhookEvent.update({
          where: { id: lockedEvent.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
            externalPaymentId: resolved.externalPaymentId,
            externalReference: resolved.externalReference,
            paymentAttemptId: currentAttempt.id,
            payload: resolved.rawPayload as Prisma.InputJsonValue,
            reconciliationRequired: financial.reconciliationRequired,
            reconciliationReason: financial.reconciliationReason,
            error: financial.reconciliationReason ?? null,
          },
        });
        return {
          accepted: true,
          duplicate: false,
          orderId: currentAttempt.orderId,
          status: resolved.status,
          value: currentAttempt.amount.toString(),
          reconciliationRequired: financial.reconciliationRequired,
        };
      });
    } catch (error) {
      await this.markWebhookFailed(event.id, safeError(error));
      throw error;
    }
  }

  private async getOrCreateWebhookEvent(
    provider: PaymentProviderName,
    receipt: PaymentWebhookReceipt,
  ) {
    const existing = await this.prisma.paymentWebhookEvent.findFirst({
      where: { provider, externalId: receipt.externalEventId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.paymentWebhookEvent.create({
        data: {
          id: randomUUID(),
          provider,
          externalId: receipt.externalEventId,
          eventType: receipt.eventType,
          externalPaymentId: receipt.externalPaymentId,
          externalReference: receipt.externalReference,
          payload: receipt.rawPayload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return this.prisma.paymentWebhookEvent.findFirstOrThrow({
          where: { provider, externalId: receipt.externalEventId },
        });
      throw error;
    }
  }

  private async claimWebhook(id: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - WEBHOOK_LEASE_MS);
    const result = await this.prisma.paymentWebhookEvent.updateMany({
      where: {
        id,
        OR: [
          { status: 'RECEIVED' },
          { status: 'FAILED' },
          { status: 'PROCESSING', processingStartedAt: { lt: cutoff } },
        ],
      },
      data: {
        status: 'PROCESSING',
        processingStartedAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  private async markWebhookFailed(id: string, error: string): Promise<void> {
    await this.prisma.paymentWebhookEvent.updateMany({
      where: { id, status: 'PROCESSING' },
      data: { status: 'FAILED', error, processedAt: null },
    });
  }
}

const lockOrder = async (transaction: Prisma.TransactionClient, id: string) => {
  await transaction.$queryRaw(
    Prisma.sql`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`,
  );
};

const lockAttempt = async (
  transaction: Prisma.TransactionClient,
  id: string,
) => {
  await transaction.$queryRaw(
    Prisma.sql`SELECT id FROM payment_attempts WHERE id = ${id} FOR UPDATE`,
  );
};

const lockWebhook = async (
  transaction: Prisma.TransactionClient,
  id: string,
) => {
  await transaction.$queryRaw(
    Prisma.sql`SELECT id FROM payment_webhook_events WHERE id = ${id} FOR UPDATE`,
  );
  return transaction.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
};

export const correlateAttempt = async (
  transaction: Prisma.TransactionClient,
  provider: PaymentProviderName,
  event: PaymentWebhookResult,
) => {
  if (event.externalPaymentId) {
    const exact = await transaction.paymentAttempt.findMany({
      where: { provider, externalPaymentId: event.externalPaymentId },
    });
    if (exact.length === 1) {
      if (!event.externalReference) return exact[0];
      const byReference = await transaction.paymentAttempt.findMany({
        where: { provider, externalReference: event.externalReference },
      });
      if (byReference.length === 0 || byReference[0].id === exact[0].id)
        return exact[0];
      return null;
    }
  }
  if (!event.externalReference) return null;
  const exactReference = await transaction.paymentAttempt.findMany({
    where: { provider, externalReference: event.externalReference },
  });
  if (exactReference.length === 1) return exactReference[0];
  const legacy = await transaction.paymentAttempt.findMany({
    where: { provider, orderId: event.externalReference },
  });
  return legacy.length === 1 ? legacy[0] : null;
};

const applyInitiationToOrder = async (
  transaction: Prisma.TransactionClient,
  attempt: Prisma.PaymentAttemptGetPayload<Prisma.PaymentAttemptDefaultArgs>,
  result: PaymentInitiationResult,
) => {
  const status = result.status;
  const order = await transaction.order.findUniqueOrThrow({
    where: { id: attempt.orderId },
    select: {
      status: true,
      paymentStatus: true,
      reservationExpiresAt: true,
      reservationReleasedAt: true,
      reconciliationRequired: true,
    },
  });
  const alreadyPaid = FINAL_ORDER_PAYMENT_STATUSES.includes(
    order.paymentStatus,
  );
  const amountMismatch =
    status === 'APPROVED' &&
    ((result.amount && cents(result.amount) !== cents(attempt.amount)) ||
      (result.currency && result.currency !== attempt.currency));
  const reservationInvalid =
    status === 'APPROVED' &&
    (order.status === 'CANCELLED' ||
      order.reservationReleasedAt !== null ||
      (order.reservationExpiresAt !== null &&
        order.reservationExpiresAt <= new Date()));
  const reconciliationRequired =
    order.reconciliationRequired || amountMismatch || reservationInvalid;
  const data: Prisma.OrderUpdateInput = {
    paymentProvider: attempt.provider,
    paymentExternalId: attempt.externalPaymentId,
    paymentExpiresAt: attempt.expiresAt,
    paymentStatus: reconciliationRequired
      ? 'PROCESSING'
      : alreadyPaid
        ? order.paymentStatus
        : status === 'APPROVED'
          ? 'PAID'
          : status === 'PROCESSING'
            ? 'PROCESSING'
            : status === 'PENDING'
              ? 'PENDING'
              : status === 'REFUNDED'
                ? 'REFUNDED'
                : status === 'PARTIALLY_REFUNDED'
                  ? 'PARTIALLY_REFUNDED'
                  : status === 'CHARGED_BACK'
                    ? 'CHARGED_BACK'
                    : 'FAILED',
  };
  if (reconciliationRequired) {
    data.reconciliationRequired = true;
    data.reconciliationReason = amountMismatch
      ? 'La respuesta aprobada no coincide con la orden.'
      : 'La reserva no permite habilitar fulfillment.';
  }
  if (
    status === 'APPROVED' &&
    !reconciliationRequired &&
    !alreadyPaid &&
    order.status === 'PENDING_PAYMENT'
  )
    data.status = 'PAID';
  await transaction.order.update({ where: { id: attempt.orderId }, data });
  if (data.status && data.status !== order.status)
    await recordStatusEvent(
      transaction,
      attempt.orderId,
      data.status as OrderStatus,
    );
  if (status === 'APPROVED' && !alreadyPaid) {
    const existingPayment = await transaction.orderPayment.findFirst({
      where: {
        orderId: attempt.orderId,
        kind: 'PAYMENT',
        OR: [
          { paymentAttemptId: attempt.id },
          {
            provider: attempt.provider,
            externalPaymentId: attempt.externalPaymentId ?? undefined,
          },
        ],
      },
    });
    if (existingPayment) return;
    await transaction.orderPayment.create({
      data: {
        id: randomUUID(),
        orderId: attempt.orderId,
        paymentAttemptId: attempt.id,
        amount: attempt.amount,
        currency: attempt.currency,
        kind: 'PAYMENT',
        provider: attempt.provider,
        externalPaymentId: attempt.externalPaymentId,
        method: attempt.provider,
        reference: attempt.externalPaymentId ?? attempt.id,
        paidAt: new Date(),
      },
    });
  }
};

export const applyWebhookResult = async (
  transaction: Prisma.TransactionClient,
  order: Prisma.OrderGetPayload<{ include: { payments: true } }>,
  attempt: Prisma.PaymentAttemptGetPayload<Prisma.PaymentAttemptDefaultArgs>,
  event: PaymentWebhookResult,
  provider: PaymentProviderName,
) => {
  const reconciliation: { required: boolean; reason?: string } = {
    required: false,
  };
  const regressiveAfterApproval =
    ['APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'].includes(
      attempt.status,
    ) &&
    [
      'PENDING',
      'PROCESSING',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
      'FAILED',
    ].includes(event.status);
  const nextAttemptStatus = regressiveAfterApproval
    ? attempt.status
    : attemptStatus(event.status);
  await transaction.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: nextAttemptStatus,
      externalPaymentId: event.externalPaymentId ?? attempt.externalPaymentId,
      rawResponse: event.rawPayload as Prisma.InputJsonValue,
      lastError: null,
      processingLeaseToken: null,
      processingLeaseUntil: null,
    },
  });

  if (event.status === 'APPROVED') {
    if (event.currency && event.currency !== order.currency) {
      reconciliation.required = true;
      reconciliation.reason = 'La moneda externa no coincide con la orden.';
    }
    if (event.amount && cents(event.amount) !== cents(order.total)) {
      reconciliation.required = true;
      reconciliation.reason = 'El importe aprobado no coincide con la orden.';
    }
    if (
      order.reservationReleasedAt ||
      (order.reservationExpiresAt && order.reservationExpiresAt <= new Date())
    ) {
      reconciliation.required = true;
      reconciliation.reason =
        'La reserva de inventario expiró antes de la aprobación externa.';
    }
    const captureExists = await transaction.orderPayment.findFirst({
      where: {
        orderId: order.id,
        kind: 'PAYMENT',
        provider,
        externalPaymentId: event.externalPaymentId ?? undefined,
      },
    });
    if (!captureExists) {
      const anotherCapture = await transaction.orderPayment.findFirst({
        where: { orderId: order.id, kind: 'PAYMENT', paidAt: { not: null } },
      });
      if (anotherCapture) {
        reconciliation.required = true;
        reconciliation.reason = 'La orden ya tiene otra captura confirmada.';
      } else {
        await transaction.orderPayment.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            paymentAttemptId: attempt.id,
            amount: event.amount ?? attempt.amount,
            currency: event.currency ?? attempt.currency,
            kind: 'PAYMENT',
            provider,
            externalPaymentId:
              event.externalPaymentId ?? attempt.externalPaymentId,
            method: provider,
            reference: event.externalPaymentId ?? attempt.id,
            paidAt: new Date(),
          },
        });
      }
    }
  } else if (
    event.status === 'REFUNDED' ||
    event.status === 'PARTIALLY_REFUNDED' ||
    event.status === 'CHARGED_BACK'
  ) {
    const kind = event.status === 'CHARGED_BACK' ? 'CHARGEBACK' : 'REFUND';
    const amount = event.amount ?? attempt.amount;
    if (event.currency && event.currency !== order.currency) {
      reconciliation.required = true;
      reconciliation.reason =
        'La moneda de la devolución no coincide con la orden.';
    }
    const captured = sumPayments(order.payments, 'PAYMENT');
    const refunded = sumPayments(order.payments, 'REFUND');
    const chargedBack = sumPayments(order.payments, 'CHARGEBACK');
    const available = captured - refunded - chargedBack;
    if (cents(amount) > available) {
      reconciliation.required = true;
      reconciliation.reason =
        'La devolución externa supera el saldo capturado disponible.';
    }
    const duplicate = event.externalOperationId
      ? await transaction.orderPayment.findFirst({
          where: { provider, externalOperationId: event.externalOperationId },
        })
      : null;
    if (!duplicate)
      await transaction.orderPayment.create({
        data: {
          id: randomUUID(),
          orderId: order.id,
          paymentAttemptId: attempt.id,
          amount,
          currency: event.currency ?? order.currency,
          kind,
          provider,
          externalPaymentId:
            event.externalPaymentId ?? attempt.externalPaymentId,
          externalOperationId: event.externalOperationId,
          method: provider,
          reference:
            event.externalOperationId ?? event.externalPaymentId ?? attempt.id,
          paidAt: new Date(),
        },
      });
    await transaction.paymentRefund?.updateMany({
      where: {
        orderId: order.id,
        externalPaymentId:
          event.externalPaymentId ?? attempt.externalPaymentId ?? '__missing__',
        status: 'PROCESSING',
      },
      data: {
        status:
          event.status === 'REFUNDED' || event.status === 'PARTIALLY_REFUNDED'
            ? 'REFUNDED'
            : 'FAILED',
        externalOperationId: event.externalOperationId,
      },
    });
  }

  const payments = await transaction.orderPayment.findMany({
    where: { orderId: order.id, paidAt: { not: null } },
  });
  const captured = sumPayments(payments, 'PAYMENT');
  const refunded = sumPayments(payments, 'REFUND');
  const chargedBack = sumPayments(payments, 'CHARGEBACK');
  const reconciliationRequired =
    order.reconciliationRequired || reconciliation.required;
  const preserveFinalStatus =
    FINAL_ORDER_PAYMENT_STATUSES.includes(order.paymentStatus) &&
    [
      'PROCESSING',
      'PENDING',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
      'FAILED',
    ].includes(event.status);
  const paymentStatus = preserveFinalStatus
    ? order.paymentStatus
    : chargedBack > 0
      ? 'CHARGED_BACK'
      : refunded >= captured && refunded > 0
        ? 'REFUNDED'
        : refunded > 0
          ? 'PARTIALLY_REFUNDED'
          : reconciliationRequired
            ? 'PROCESSING'
            : event.status === 'APPROVED' || captured >= cents(order.total)
              ? 'PAID'
              : event.status === 'PROCESSING'
                ? 'PROCESSING'
                : event.status === 'PENDING'
                  ? 'PENDING'
                  : 'FAILED';
  const orderUpdate: Prisma.OrderUpdateInput = {
    paymentStatus,
    reconciliationRequired,
    reconciliationReason:
      reconciliation.reason ??
      (reconciliationRequired ? order.reconciliationReason : null),
    ...(event.externalPaymentId
      ? {
          paymentProvider: provider,
          paymentExternalId: event.externalPaymentId,
        }
      : {}),
  };
  if (
    event.status === 'APPROVED' &&
    order.status === 'PENDING_PAYMENT' &&
    paymentStatus === 'PAID'
  )
    orderUpdate.status = 'PAID';
  if (
    !FINAL_ORDER_PAYMENT_STATUSES.includes(order.paymentStatus) &&
    (event.status === 'PROCESSING' || event.status === 'PENDING')
  )
    orderUpdate.status = order.status;
  await transaction.order.update({
    where: { id: order.id },
    data: orderUpdate,
  });
  if (orderUpdate.status && orderUpdate.status !== order.status)
    await recordStatusEvent(
      transaction,
      order.id,
      orderUpdate.status as OrderStatus,
    );
  return {
    reconciliationRequired: reconciliation.required,
    reconciliationReason: reconciliation.reason,
  };
};

const providerForMethod = (method: string | null): PaymentProviderName => {
  if (method === 'MERCADO_PAGO') return 'mercadopago';
  if (method === 'PAYWAY') return 'payway';
  throw new PaymentValidationError('El pedido no usa una pasarela externa.');
};

const recordStatusEvent = async (
  transaction: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
): Promise<void> => {
  const events = transaction.orderStatusEvent;
  if (!events) return;
  const existing = await events.findFirst({
    where: { orderId, status },
    select: { id: true },
  });
  if (existing) return;
  await events.create({ data: { id: randomUUID(), orderId, status } });
};

const paymentOwnerWhere = (owner: PaymentOwner): Prisma.OrderWhereInput => {
  if (owner.admin) return {};
  const conditions: Prisma.OrderWhereInput[] = [];
  if (owner.customerId) conditions.push({ customerId: owner.customerId });
  if (owner.publicTokenHash)
    conditions.push({ publicAccessTokenHash: owner.publicTokenHash });
  return conditions.length === 1 ? conditions[0] : { OR: conditions };
};

const attemptStatus = (status: NormalizedPaymentStatus): PaymentAttemptStatus =>
  status;

const attemptStatusToNormalized = (
  status: PaymentAttemptStatus,
): NormalizedPaymentStatus => (status === 'CREATED' ? 'PROCESSING' : status);

const mapInitiation = (
  attempt: Prisma.PaymentAttemptGetPayload<Prisma.PaymentAttemptDefaultArgs>,
  status: NormalizedPaymentStatus,
  order?: {
    paymentStatus: PaymentStatus;
    reconciliationRequired: boolean;
    reservationExpiresAt: Date | null;
  },
): PaymentInitiation => ({
  orderId: attempt.orderId,
  provider: attempt.provider as PaymentProviderName,
  action: attempt.paymentUrl
    ? 'REDIRECT'
    : status === 'APPROVED' || status === 'PENDING' || status === 'PROCESSING'
      ? 'NONE'
      : 'RETRY',
  paymentUrl: attempt.paymentUrl,
  externalId: attempt.externalPaymentId ?? attempt.externalPreferenceId,
  status,
  expiresAt: attempt.expiresAt,
  canRetry:
    !order?.reconciliationRequired &&
    ['REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(status) &&
    (!order?.reservationExpiresAt || order.reservationExpiresAt > new Date()) &&
    (!attempt.expiresAt || attempt.expiresAt > new Date()),
  paymentStatus:
    order?.paymentStatus ??
    (status === 'APPROVED'
      ? 'PAID'
      : status === 'PROCESSING'
        ? 'PROCESSING'
        : status === 'PENDING'
          ? 'PENDING'
          : 'FAILED'),
  reconciliationRequired: order?.reconciliationRequired ?? false,
});

const mapRefund = (
  value: Prisma.PaymentRefundGetPayload<Prisma.PaymentRefundDefaultArgs>,
): PaymentRefund => ({
  id: value.id,
  orderId: value.orderId,
  amount: value.amount.toString(),
  currency: 'ARS',
  provider: value.provider as PaymentProviderName,
  externalOperationId: value.externalOperationId,
  status: value.status,
  failureReason: value.failureReason,
  createdAt: value.createdAt,
});

const requestFingerprint = (input: {
  orderId: string;
  provider: string;
  amount: string;
  currency: string;
  paymentMethod?: TokenizedCardPayment;
}): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        orderId: input.orderId,
        provider: input.provider,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: input.paymentMethod
          ? {
              type: input.paymentMethod.type,
              token: createHash('sha256')
                .update(input.paymentMethod.token)
                .digest('hex'),
              installments: input.paymentMethod.installments,
              paymentMethodReference:
                input.paymentMethod.paymentMethodReference,
              cardBin: input.paymentMethod.cardBin,
            }
          : null,
      }),
    )
    .digest('hex');

const cents = (value: string | number | Prisma.Decimal): bigint => {
  const normalized = String(value).trim();
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(`${whole}${fraction.padEnd(2, '0').slice(0, 2)}`);
};

const amountFromCents = (value: bigint): string => {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const text = absolute.toString().padStart(3, '0');
  return `${sign}${text.slice(0, -2)}.${text.slice(-2)}`;
};

const sumPayments = (
  payments: Array<{ amount: Prisma.Decimal; kind: OrderPaymentKind }>,
  kind: OrderPaymentKind,
): bigint =>
  payments
    .filter((payment) => payment.kind === kind)
    .reduce((sum, payment) => sum + cents(payment.amount), 0n);

const safeError = (error: unknown): string =>
  error instanceof Error ? error.message.slice(0, 500) : 'Error de proveedor.';
