import type {
  NormalizedPaymentStatus,
  PaymentProviderName,
} from '../../../shared/domain/payment.types';
import type { TokenizedCardPayment } from '../../../shared/domain/payment.types';
import type { PaymentWebhookReceipt } from '../../../shared/domain/payment.types';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentOwner {
  customerId?: string;
  publicTokenHash?: string;
  admin?: boolean;
}

export interface PaymentInitiation {
  orderId: string;
  provider: PaymentProviderName;
  action: 'REDIRECT' | 'NONE' | 'RETRY';
  paymentUrl: string | null;
  externalId: string | null;
  status: NormalizedPaymentStatus;
  expiresAt: Date | null;
  canRetry: boolean;
  paymentStatus:
    | 'UNPAID'
    | 'PENDING'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'PARTIALLY_REFUNDED'
    | 'REFUNDED'
    | 'CHARGED_BACK';
  reconciliationRequired: boolean;
}

export interface PaymentRefund {
  id: string;
  orderId: string;
  amount: string;
  currency: 'ARS';
  provider: PaymentProviderName;
  externalOperationId: string | null;
  status: 'PROCESSING' | 'REFUNDED' | 'FAILED';
  failureReason: string | null;
  createdAt: Date;
}

export interface PaymentRepository {
  initiate(
    orderId: string,
    owner: PaymentOwner,
    paymentMethod?: TokenizedCardPayment,
    idempotencyKey?: string,
  ): Promise<PaymentInitiation>;
  handleWebhook(input: {
    provider: PaymentProviderName;
    receipt: PaymentWebhookReceipt;
  }): Promise<{
    accepted: boolean;
    duplicate: boolean;
    orderId?: string;
    status?: string;
    value?: string;
    reconciliationRequired?: boolean;
  }>;
  refund(
    orderId: string,
    owner: PaymentOwner,
    amount: string | undefined,
    idempotencyKey: string,
  ): Promise<PaymentRefund>;
  status(orderId: string, owner: PaymentOwner): Promise<PaymentInitiation>;
}
