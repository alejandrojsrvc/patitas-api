import type { PaymentProviderName } from '../../../shared/domain/payment.types';

export const PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY = Symbol(
  'PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY',
);

export interface PaymentProviderConfiguration {
  id: string;
  provider: PaymentProviderName;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentProviderConfigurationRepository {
  list(): Promise<PaymentProviderConfiguration[]>;
  find(
    provider: PaymentProviderName,
  ): Promise<PaymentProviderConfiguration | null>;
  isEnabled(provider: PaymentProviderName): Promise<boolean>;
  update(
    provider: PaymentProviderName,
    input: { enabled?: boolean; priority?: number },
  ): Promise<PaymentProviderConfiguration>;
}
