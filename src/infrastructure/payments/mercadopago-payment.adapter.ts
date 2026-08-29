import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  MercadoPagoConfig,
  Payment,
  PaymentRefund,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';
import type {
  InitiatePaymentInput,
  PaymentInitiationResult,
  PaymentProvider,
  PaymentWebhookReceipt,
  PaymentWebhookResult,
} from '../../shared/application/ports/payment-provider.interface';

@Injectable()
export class MercadoPagoPaymentAdapter implements PaymentProvider {
  public readonly name = 'mercadopago';
  private readonly accessToken: string;
  private readonly webhookSecret: string | undefined;
  private readonly notificationUrl: string | undefined;
  private readonly preference: Preference;
  private readonly payment: Payment;
  private readonly refund: PaymentRefund;

  public constructor(config: ConfigService) {
    this.accessToken = config
      .get<string>('MERCADOPAGO_ACCESS_TOKEN', '')
      .trim();
    this.webhookSecret =
      config.get<string>('MERCADOPAGO_WEBHOOK_SECRET')?.trim() || undefined;
    this.notificationUrl =
      config.get<string>('MERCADOPAGO_NOTIFICATION_URL')?.trim() || undefined;
    const mercadoPagoConfig = new MercadoPagoConfig({
      accessToken: this.accessToken,
    });
    this.preference = new Preference(mercadoPagoConfig);
    this.payment = new Payment(mercadoPagoConfig);
    this.refund = new PaymentRefund(mercadoPagoConfig);
  }

  public async refundPayment(input: {
    paymentId: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
  }) {
    if (!this.accessToken)
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado.');
    try {
      const response = await this.refund.create({
        payment_id: input.paymentId,
        body: { amount: Number(input.amount) },
        requestOptions: { idempotencyKey: input.idempotencyKey },
      });
      const status = String(response.status ?? '').toLowerCase();
      return {
        status:
          status === 'approved' || status === 'refunded'
            ? ('REFUNDED' as const)
            : status === 'pending' || status === 'in_process'
              ? ('PROCESSING' as const)
              : ('FAILED' as const),
        externalOperationId:
          response.id !== undefined ? String(response.id) : undefined,
        rawResponse: sanitize(response),
      };
    } catch (error) {
      return {
        status: 'FAILED' as const,
        rawResponse: sanitize({ error: safeError(error) }),
      };
    }
  }

  public createExternalReference(input: {
    orderId: string;
    attemptId: string;
  }): string {
    return `order-${input.orderId}-${createHash('sha256')
      .update(input.attemptId)
      .digest('hex')
      .slice(0, 16)}`;
  }

  public async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<PaymentInitiationResult> {
    if (!this.accessToken)
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado.');
    const response = await this.preference.create({
      body: {
        items: [
          {
            id: input.orderId,
            title: input.title,
            quantity: 1,
            currency_id: input.currency,
            unit_price: Number(input.amount),
          },
        ],
        payer: { email: input.payerEmail },
        external_reference: input.externalReference,
        notification_url: input.notificationUrl ?? this.notificationUrl,
        expires: Boolean(input.expiresAt),
        expiration_date_to: input.expiresAt?.toISOString(),
      },
      requestOptions: { idempotencyKey: input.idempotencyKey },
    });
    if (typeof response.init_point !== 'string')
      throw new Error('Mercado Pago no pudo crear la preferencia.');
    return {
      provider: this.name,
      externalId: response.id,
      paymentUrl: response.init_point,
      status: 'PENDING',
      amount: input.amount,
      currency: input.currency,
      expiresAt: input.expiresAt,
      rawResponse: response,
    };
  }

  public parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    dataId?: string | string[];
  }): Promise<PaymentWebhookReceipt> {
    const body = asRecord(input.body);
    const data = asRecord(body.data);
    const bodyDataId = scalarString(data.id);
    const queryDataId = scalarString(input.dataId);
    if (bodyDataId && queryDataId && bodyDataId !== queryDataId)
      throw new Error('El ID del webhook de Mercado Pago no coincide.');
    this.verifySignature(input.headers, queryDataId ?? bodyDataId);
    const type =
      scalarString(body.type) ?? scalarString(body.action) ?? 'payment';
    const paymentId = bodyDataId ?? scalarString(body.id) ?? '';
    return Promise.resolve({
      externalEventId:
        scalarString(body.id) ?? `${type}:${paymentId || 'unknown'}`,
      eventType: type,
      externalPaymentId: paymentId || undefined,
      externalReference: scalarString(body.external_reference),
      rawPayload: sanitize(input.body),
    });
  }

  public async resolveWebhook(
    receipt: PaymentWebhookReceipt,
  ): Promise<PaymentWebhookResult> {
    const payment = receipt.eventType.includes('merchant_order')
      ? { status: 'PENDING' as const, externalReference: undefined }
      : await this.fetchPaymentStatus(receipt.externalPaymentId ?? '');
    return {
      ...receipt,
      externalReference: receipt.externalReference ?? payment.externalReference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  private verifySignature(
    headers: Record<string, string | string[] | undefined>,
    dataId: string | string[] | undefined,
  ): void {
    if (!this.webhookSecret)
      throw new Error(
        'MERCADOPAGO_WEBHOOK_SECRET no está configurada para validar el webhook.',
      );
    const signature = single(headers['x-signature']);
    const requestId = single(headers['x-request-id']);
    if (!signature || !requestId)
      throw new Error('Webhook de Mercado Pago sin firma.');
    try {
      WebhookSignatureValidator.validate({
        xSignature: signature,
        xRequestId: requestId,
        dataId,
        secret: this.webhookSecret,
      });
    } catch {
      throw new Error('Firma de webhook de Mercado Pago inválida.');
    }
  }

  private async fetchPaymentStatus(paymentId: string): Promise<{
    status: PaymentWebhookResult['status'];
    externalReference?: string;
    amount?: string;
    currency?: string;
  }> {
    if (!paymentId || !this.accessToken) return { status: 'PENDING' };
    try {
      const response = await this.payment.get({ id: paymentId });
      return {
        status:
          (
            {
              approved: 'APPROVED',
              pending: 'PENDING',
              in_process: 'PENDING',
              rejected: 'REJECTED',
              cancelled: 'CANCELLED',
              refunded: 'REFUNDED',
              partially_refunded: 'PARTIALLY_REFUNDED',
              charged_back: 'CHARGED_BACK',
              in_mediation: 'PROCESSING',
            } as Record<string, PaymentWebhookResult['status']>
          )[response.status ?? 'pending'] ?? 'PENDING',
        externalReference: response.external_reference,
        amount:
          typeof response.transaction_amount === 'number'
            ? response.transaction_amount.toFixed(2)
            : undefined,
        currency: response.currency_id,
      };
    } catch (error) {
      throw new Error(
        `No se pudo verificar el pago de Mercado Pago: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const scalarString = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value === null || typeof value !== 'object') return value;
  const blocked = new Set(['token', 'card_number', 'security_code']);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitize(item)]),
  );
};

const safeError = (error: unknown): string =>
  error instanceof Error ? error.message.slice(0, 500) : 'Error desconocido';
