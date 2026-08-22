export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreatePaymentLinkInput {
  orderId: string;
  title: string;
  amount: string;
  currency: string;
  payerEmail: string;
  externalReference: string;
  notificationUrl?: string;
  expiresAt?: Date;
}

export interface PaymentLinkResult {
  provider: string;
  preferenceId?: string;
  paymentUrl: string;
  expiresAt?: Date;
  rawResponse?: unknown;
}

export interface PaymentWebhookResult {
  externalEventId: string;
  eventType: string;
  externalPaymentId?: string;
  externalReference?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult>;
  parseWebhook(input: { headers: Record<string, string | string[] | undefined>; body: unknown }): Promise<PaymentWebhookResult>;
}
