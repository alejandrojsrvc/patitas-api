export const PAYMENT_PROVIDER_RESOLVER = Symbol('PAYMENT_PROVIDER_RESOLVER');

import type {
  NormalizedPaymentStatus,
  PaymentProviderName,
  PaymentWebhookReceipt,
  TokenizedCardPayment,
} from '../../domain/payment.types';

export type {
  NormalizedPaymentStatus,
  PaymentProviderName,
  PaymentWebhookReceipt,
  TokenizedCardPayment,
} from '../../domain/payment.types';

export interface InitiatePaymentInput {
  attemptId: string;
  orderId: string;
  title: string;
  amount: string;
  currency: string;
  payerEmail: string;
  externalReference: string;
  idempotencyKey: string;
  notificationUrl?: string;
  expiresAt?: Date;
  paymentMethod?: TokenizedCardPayment;
}

export interface PaymentInitiationResult {
  provider: PaymentProviderName;
  externalId?: string;
  paymentUrl?: string;
  status: NormalizedPaymentStatus;
  expiresAt?: Date;
  amount?: string;
  currency?: string;
  rawResponse?: unknown;
}

export interface RefundPaymentInput {
  paymentId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentRefundResult {
  status: 'PROCESSING' | 'REFUNDED' | 'FAILED';
  externalOperationId?: string;
  rawResponse?: unknown;
}

export interface PaymentWebhookResult {
  externalEventId: string;
  eventType: string;
  externalPaymentId?: string;
  externalReference?: string;
  status: NormalizedPaymentStatus;
  amount?: string;
  currency?: string;
  externalOperationId?: string;
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createExternalReference(input: {
    orderId: string;
    attemptId: string;
  }): string;
  initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<PaymentInitiationResult>;
  refundPayment(input: RefundPaymentInput): Promise<PaymentRefundResult>;
  parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    dataId?: string | string[];
  }): Promise<PaymentWebhookReceipt>;
  resolveWebhook(receipt: PaymentWebhookReceipt): Promise<PaymentWebhookResult>;
}

export interface PaymentProviderResolver {
  resolve(provider: PaymentProviderName): PaymentProvider;
}
