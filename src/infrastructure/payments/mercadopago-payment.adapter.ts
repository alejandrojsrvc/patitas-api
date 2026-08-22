import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CreatePaymentLinkInput, PaymentLinkResult, PaymentProvider, PaymentWebhookResult } from '../../shared/application/ports/payment-provider.interface';

@Injectable()
export class MercadoPagoPaymentAdapter implements PaymentProvider {
  public readonly name = 'mercadopago';
  private readonly accessToken: string;
  private readonly webhookSecret: string | undefined;
  private readonly notificationUrl: string | undefined;

  public constructor(config: ConfigService) {
    this.accessToken = config.get<string>('MERCADOPAGO_ACCESS_TOKEN', '').trim();
    this.webhookSecret = config.get<string>('MERCADOPAGO_WEBHOOK_SECRET')?.trim() || undefined;
    this.notificationUrl = config.get<string>('MERCADOPAGO_NOTIFICATION_URL')?.trim() || undefined;
  }

  public async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    if (!this.accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado.');
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': input.orderId },
      body: JSON.stringify({
        items: [{ id: input.orderId, title: input.title, quantity: 1, currency_id: input.currency, unit_price: Number(input.amount) }],
        payer: { email: input.payerEmail },
        external_reference: input.externalReference,
        notification_url: input.notificationUrl ?? this.notificationUrl,
        expires: Boolean(input.expiresAt),
        expiration_date_to: input.expiresAt?.toISOString(),
      }),
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || typeof body.init_point !== 'string') throw new Error('Mercado Pago no pudo crear la preferencia.');
    return { provider: this.name, preferenceId: typeof body.id === 'string' ? body.id : undefined, paymentUrl: body.init_point, expiresAt: input.expiresAt, rawResponse: body };
  }

  public async parseWebhook(input: { headers: Record<string, string | string[] | undefined>; body: unknown }): Promise<PaymentWebhookResult> {
    this.verifySignature(input.headers, input.body);
    const body = (input.body ?? {}) as Record<string, unknown>;
    const data = (body.data ?? {}) as Record<string, unknown>;
    const type = String(body.type ?? body.action ?? 'payment');
    const paymentId = String(data.id ?? body.id ?? '');
    const payment = type.includes('merchant_order') ? { status: 'PENDING' as const, externalReference: undefined } : await this.fetchPaymentStatus(paymentId);
    return { externalEventId: `${type}:${paymentId}`, eventType: type, externalPaymentId: paymentId || undefined, externalReference: typeof body.external_reference === 'string' ? body.external_reference : payment.externalReference, status: payment.status, rawPayload: input.body };
  }

  private verifySignature(headers: Record<string, string | string[] | undefined>, body: unknown): void {
    if (!this.webhookSecret) return;
    const signature = single(headers['x-signature']);
    const requestId = single(headers['x-request-id']);
    if (!signature || !requestId) throw new Error('Webhook de Mercado Pago sin firma.');
    const parts = Object.fromEntries(signature.split(',').map((item) => item.split('=').map((value) => value.trim())));
    const dataId = String(((body as Record<string, unknown> | null)?.data as Record<string, unknown> | undefined)?.id ?? '').toLowerCase();
    const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts ?? ''};`;
    const expected = createHmac('sha256', this.webhookSecret).update(manifest).digest('hex');
    const received = String(parts.v1 ?? '');
    if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) throw new Error('Firma de webhook de Mercado Pago inválida.');
  }

  private async fetchPaymentStatus(paymentId: string): Promise<{ status: PaymentWebhookResult['status']; externalReference?: string }> {
    if (!paymentId || !this.accessToken) return { status: 'PENDING' };
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) return { status: 'PENDING' };
    const body = await response.json() as { status?: string; external_reference?: string };
    return { status: ({ approved: 'APPROVED', pending: 'PENDING', in_process: 'PENDING', rejected: 'REJECTED', cancelled: 'CANCELLED', refunded: 'FAILED', charged_back: 'FAILED' } as Record<string, PaymentWebhookResult['status']>)[body.status ?? 'pending'] ?? 'PENDING', externalReference: body.external_reference };
  }
}

const single = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value;
