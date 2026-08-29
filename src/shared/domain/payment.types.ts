export type PaymentProviderName = 'simulated' | 'mercadopago' | 'payway';

export type NormalizedPaymentStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'PROCESSING'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'CHARGED_BACK';

export interface TokenizedCardPayment {
  type: 'TOKENIZED_CARD';
  token: string;
  installments: number;
  paymentMethodReference?: number;
  cardBin?: string;
}

export interface PaymentWebhookReceipt {
  externalEventId: string;
  eventType: string;
  externalPaymentId?: string;
  externalReference?: string;
  rawPayload: unknown;
}
