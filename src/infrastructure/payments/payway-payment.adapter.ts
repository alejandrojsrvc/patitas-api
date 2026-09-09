import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  InitiatePaymentInput,
  NormalizedPaymentStatus,
  PaymentInitiationResult,
  PaymentProvider,
  PaymentWebhookReceipt,
  PaymentWebhookResult,
} from '../../shared/application/ports/payment-provider.interface';

@Injectable()
export class PaywayPaymentAdapter implements PaymentProvider {
  public readonly name = 'payway';
  private readonly siteIds: PaywaySiteIds;
  private readonly privateApiKey: string;
  private readonly apiBaseUrl: string;
  private readonly webhookSecret: string;

  public constructor(config: ConfigService) {
    this.siteIds = {
      visa: readConfig(config, 'PAYWAY_SITE_ID_VISA'),
      mastercard: readConfig(config, 'PAYWAY_SITE_ID_MASTERCARD'),
      americanExpress: readConfig(config, 'PAYWAY_SITE_ID_AMERICAN_EXPRESS'),
      discover: readConfig(config, 'PAYWAY_SITE_ID_DISCOVER'),
      cabal: readConfig(config, 'PAYWAY_SITE_ID_CABAL'),
    };
    this.privateApiKey = config.get<string>('PAYWAY_PRIVATE_API_KEY', '').trim();
    this.apiBaseUrl = config.get<string>('PAYWAY_API_BASE_URL', '').trim().replace(/\/$/, '');
    this.webhookSecret = config.get<string>('PAYWAY_WEBHOOK_SECRET', '').trim();
  }

  public assertReady(): void {
    if (!this.privateApiKey || !this.apiBaseUrl) throw new Error('Payway requiere PAYWAY_PRIVATE_API_KEY y PAYWAY_API_BASE_URL.');
  }

  public createExternalReference(input: { orderId: string; attemptId: string }): string {
    return createHash('sha256').update(`${input.orderId}:${input.attemptId}`).digest('hex').slice(0, 32);
  }

  public async initiatePayment(input: InitiatePaymentInput): Promise<PaymentInitiationResult> {
    this.assertReady();
    if (!input.paymentMethod?.token) throw new Error('Payway requiere un token de tarjeta.');
    if (!input.paymentMethod.paymentMethodReference) throw new Error('Payway requiere el ID del medio de pago.');
    if (!input.paymentMethod.cardBin) throw new Error('Payway requiere el BIN de la tarjeta.');
    if (!Number.isInteger(input.paymentMethod.installments) || input.paymentMethod.installments < 1)
      throw new Error('Payway requiere una cantidad válida de cuotas.');
    const siteId = this.siteIdFor(input.paymentMethod.paymentMethodReference);

    const response = await this.request('/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        ...(siteId ? { site_id: siteId } : {}),
        site_transaction_id: input.externalReference,
        token: input.paymentMethod.token,
        payment_method_id: input.paymentMethod.paymentMethodReference,
        bin: input.paymentMethod.cardBin,
        amount: toMinorUnits(input.amount),
        currency: input.currency,
        installments: input.paymentMethod.installments,
        description: input.title,
        payment_type: 'single',
        sub_payments: [],
        customer: { email: input.payerEmail },
      }),
    });

    return {
      provider: this.name,
      externalId: scalarString(response.id),
      status: mapPaywayInitiationStatus(response.status),
      amount: normalizeMoney(response.amount),
      currency: scalarString(response.currency),
      rawResponse: sanitize(response),
    };
  }

  public parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    rawBody?: Buffer;
  }): Promise<PaymentWebhookReceipt> {
    this.verifyWebhookSignature(input.headers, input.rawBody);
    const body = asRecord(input.body);
    const data = asRecord(body.data);
    const paymentId = scalarString(data.id) ?? scalarString(body.id) ?? scalarString(body.payment_id);
    if (!paymentId) throw new Error('Webhook de Payway sin ID de pago.');
    const state = scalarString(body.status) ?? scalarString(body.state) ?? 'unknown';
    const eventId =
      scalarString(body.event_id) ??
      scalarString(body.notification_id) ??
      (state === 'unknown' ? `payment:${paymentId}` : `payment:${paymentId}:${state.toLowerCase()}`);

    // The authenticated lookup is the source of truth; webhook bodies are not trusted.
    return Promise.resolve({
      externalEventId: eventId,
      eventType: scalarString(body.type) ?? 'payment',
      externalPaymentId: paymentId,
      externalReference: scalarString(body.site_transaction_id),
      rawPayload: sanitize(input.body),
    });
  }

  private verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, rawBody?: Buffer): void {
    if (!this.webhookSecret) throw new Error('PAYWAY_WEBHOOK_SECRET no está configurado.');
    const received = scalarString(headers['x-payway-signature'] ?? headers['x-signature'])?.replace(/^sha256=/i, '');
    const timestamp = scalarString(headers['x-payway-timestamp']);
    if (!received || !/^[a-f0-9]{64}$/i.test(received) || !timestamp || !/^\d{10,13}$/.test(timestamp) || !rawBody) {
      throw new Error('Webhook de Payway sin firma válida.');
    }
    const timestampMs = Number(timestamp) < 1_000_000_000_000 ? Number(timestamp) * 1_000 : Number(timestamp);
    if (Math.abs(Date.now() - timestampMs) > 5 * 60_000) throw new Error('Webhook de Payway vencido.');
    const expected = createHmac('sha256', this.webhookSecret).update(timestamp).update('.').update(rawBody).digest('hex');
    if (!timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))) throw new Error('Firma de webhook de Payway inválida.');
  }

  public async resolveWebhook(receipt: PaymentWebhookReceipt): Promise<PaymentWebhookResult> {
    const payment = await this.request(`/payments/${encodeURIComponent(receipt.externalPaymentId ?? '')}`);
    const externalReference = scalarString(payment.site_transaction_id) ?? scalarString(payment.external_reference);
    return {
      ...receipt,
      externalReference,
      status: mapPaywayPaymentStatus(payment.status),
      amount: normalizeMoney(payment.amount),
      currency: scalarString(payment.currency),
      externalOperationId: scalarString(payment.operation_id) ?? scalarString(payment.refund_id),
      rawPayload: sanitize(payment),
    };
  }

  public async refundPayment(input: { paymentId: string; amount: string; currency: string; idempotencyKey: string }) {
    const response = await this.request(`/payments/${encodeURIComponent(input.paymentId)}/refunds`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        amount: toMinorUnits(input.amount),
        currency: input.currency,
      }),
    });
    const status = mapRefundStatus(response.status);
    return {
      status,
      externalOperationId: scalarString(response.operation_id) ?? scalarString(response.refund_id),
      rawResponse: sanitize(response),
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    this.assertReady();
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.privateApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init.headers,
      },
    });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      const error = asRecord(payload);
      const message = scalarString(error.message) ?? scalarString(error.error) ?? `Payway respondió HTTP ${response.status}.`;
      throw new Error(message);
    }
    return asRecord(payload);
  }

  private siteIdFor(paymentMethodReference?: number): string | undefined {
    if (!paymentMethodReference) return undefined;
    return PAYWAY_SITE_ID_BY_PAYMENT_METHOD[paymentMethodReference]?.(this.siteIds);
  }
}

type PaywaySiteIds = {
  visa?: string;
  mastercard?: string;
  americanExpress?: string;
  discover?: string;
  cabal?: string;
};

const PAYWAY_SITE_ID_BY_PAYMENT_METHOD: Record<number, (siteIds: PaywaySiteIds) => string | undefined> = {
  1: (siteIds) => siteIds.visa,
  31: (siteIds) => siteIds.visa,
  6: (siteIds) => siteIds.americanExpress,
  65: (siteIds) => siteIds.americanExpress,
  15: (siteIds) => siteIds.mastercard,
  66: (siteIds) => siteIds.mastercard,
  27: (siteIds) => siteIds.cabal,
  63: (siteIds) => siteIds.cabal,
  67: (siteIds) => siteIds.cabal,
};

const readConfig = (config: ConfigService, key: string): string | undefined => config.get<string>(key)?.trim() || undefined;

const mapStatus = (value: unknown): NormalizedPaymentStatus => {
  const status = scalarString(value)?.toLowerCase() ?? '';
  return (
    (
      {
        approved: 'APPROVED',
        paid: 'APPROVED',
        pending: 'PENDING',
        pre_approved: 'PROCESSING',
        processing: 'PROCESSING',
        rejected: 'REJECTED',
        declined: 'REJECTED',
        cancelled: 'CANCELLED',
        voided: 'CANCELLED',
        expired: 'EXPIRED',
        error: 'FAILED',
        failed: 'FAILED',
        refunded: 'REFUNDED',
        partially_refunded: 'PARTIALLY_REFUNDED',
        charged_back: 'CHARGED_BACK',
      } as Record<string, NormalizedPaymentStatus>
    )[status] ?? 'PENDING'
  );
};

// Payway is synchronous for this checkout: only an approved payment may keep
// the order alive. Pending/processing/unknown responses are treated as a
// rejection by the business flow and never exposed as a pending checkout.
const mapPaywayInitiationStatus = (value: unknown): NormalizedPaymentStatus => (mapStatus(value) === 'APPROVED' ? 'APPROVED' : 'REJECTED');

const mapPaywayPaymentStatus = (value: unknown): NormalizedPaymentStatus => {
  const status = mapStatus(value);
  return status === 'APPROVED' || status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED' || status === 'CHARGED_BACK' ? status : 'REJECTED';
};

const mapRefundStatus = (value: unknown): 'PROCESSING' | 'REFUNDED' | 'FAILED' => {
  const status = scalarString(value)?.toLowerCase() ?? '';
  if (['approved', 'refunded', 'completed', 'paid'].includes(status)) return 'REFUNDED';
  if (['pending', 'processing', 'in_process'].includes(status)) return 'PROCESSING';
  return 'FAILED';
};

const toMinorUnits = (amount: string): number => Math.round(Number(amount) * 100);

const normalizeMoney = (value: unknown): string | undefined => {
  if (typeof value === 'number') return (value / 100).toFixed(2);
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return /^\d+$/.test(normalized) ? (Number(normalized) / 100).toFixed(2) : Number(normalized).toFixed(2);
};

const sensitiveKeys = new Set(['token', 'card_token', 'security_code', 'card_number']);

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeys.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitize(item)]),
  );
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const scalarString = (value: unknown): string | undefined => (typeof value === 'string' || typeof value === 'number' ? String(value) : undefined);
