import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoConfig,
  Payment,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';
import type {
  CreatePaymentLinkInput,
  PaymentLinkResult,
  PaymentProvider,
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
  }

  public async createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<PaymentLinkResult> {
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
      requestOptions: { idempotencyKey: input.orderId },
    });
    if (typeof response.init_point !== 'string')
      throw new Error('Mercado Pago no pudo crear la preferencia.');
    return {
      provider: this.name,
      preferenceId: response.id,
      paymentUrl: response.init_point,
      expiresAt: input.expiresAt,
      rawResponse: response,
    };
  }

  public async parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    dataId?: string | string[];
  }): Promise<PaymentWebhookResult> {
    const body = asRecord(input.body);
    const data = asRecord(body.data);
    this.verifySignature(input.headers, input.dataId ?? scalarString(data.id));
    const type =
      scalarString(body.type) ?? scalarString(body.action) ?? 'payment';
    const paymentId = scalarString(data.id) ?? scalarString(body.id) ?? '';
    const payment = type.includes('merchant_order')
      ? { status: 'PENDING' as const, externalReference: undefined }
      : await this.fetchPaymentStatus(paymentId);
    return {
      externalEventId: `${type}:${paymentId}`,
      eventType: type,
      externalPaymentId: paymentId || undefined,
      externalReference:
        typeof body.external_reference === 'string'
          ? body.external_reference
          : payment.externalReference,
      status: payment.status,
      rawPayload: input.body,
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
              refunded: 'FAILED',
              charged_back: 'FAILED',
            } as Record<string, PaymentWebhookResult['status']>
          )[response.status ?? 'pending'] ?? 'PENDING',
        externalReference: response.external_reference,
      };
    } catch {
      return { status: 'PENDING' };
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
