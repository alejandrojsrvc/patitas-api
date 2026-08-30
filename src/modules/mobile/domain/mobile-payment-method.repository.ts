import type { PaymentProviderName } from '../../../shared/domain/payment.types';
import { DomainError } from '../../../shared/domain/domain-error';

export class MobilePaymentMethodError extends DomainError {
  public constructor(message: string) {
    super(message, 'MOBILE_PAYMENT_METHOD_INVALID');
  }
}

export const MOBILE_PAYMENT_METHOD_REPOSITORY = Symbol(
  'MOBILE_PAYMENT_METHOD_REPOSITORY',
);

export interface MobilePaymentMethod {
  id: string;
  provider: PaymentProviderName;
  type: string;
  brand: string | null;
  lastFour: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
  isDefault: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMobilePaymentMethodInput {
  provider: PaymentProviderName;
  type: string;
  brand?: string | null;
  lastFour?: string | null;
  expirationMonth?: number | null;
  expirationYear?: number | null;
  providerPaymentMethodId: string;
  isDefault?: boolean;
}

export interface MobilePaymentMethodRepository {
  list(customerId: string): Promise<MobilePaymentMethod[]>;
  create(
    customerId: string,
    input: CreateMobilePaymentMethodInput,
  ): Promise<MobilePaymentMethod>;
  remove(id: string, customerId: string): Promise<void>;
  findOwned(
    id: string,
    customerId: string,
  ): Promise<MobilePaymentMethod | null>;
}
