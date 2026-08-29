import type {
  PaymentProviderName,
  PaymentProviderResolver,
} from '../../../shared/application/ports/payment-provider.interface';
import type { PaymentProviderConfigurationRepository } from '../domain/payment-provider-configuration.repository';
import { DomainError } from '../../../shared/domain/domain-error';

export class PaymentProviderConfigurationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_PROVIDER_CONFIGURATION_INVALID');
  }
}

const PAYMENT_METHODS: Record<PaymentProviderName, string> = {
  simulated: 'SIMULATED_CARD',
  mercadopago: 'MERCADO_PAGO',
  payway: 'PAYWAY',
};

export class PaymentProviderConfigurationService {
  public constructor(
    private readonly repository: PaymentProviderConfigurationRepository,
    private readonly providers: PaymentProviderResolver,
  ) {}

  public list() {
    return this.repository.list();
  }

  public update(
    provider: string,
    input: { enabled?: boolean; priority?: number },
  ) {
    return this.repository.update(normalizeProvider(provider), input);
  }

  public async availableMethods() {
    const configurations = await this.repository.list();
    return configurations
      .filter((configuration) => configuration.enabled)
      .filter((configuration) => {
        try {
          this.providers.resolve(configuration.provider);
          return true;
        } catch {
          return false;
        }
      })
      .sort((left, right) => right.priority - left.priority)
      .map((configuration) => ({
        provider: configuration.provider,
        paymentMethod: PAYMENT_METHODS[configuration.provider],
        priority: configuration.priority,
      }));
  }
}

export const normalizeProvider = (value: string): PaymentProviderName => {
  const normalized = value.trim().toLowerCase().replaceAll('-', '_');
  if (normalized === 'mercado_pago' || normalized === 'mercadopago')
    return 'mercadopago';
  if (normalized === 'payway') return 'payway';
  if (normalized === 'simulated' || normalized === 'simulated_card')
    return 'simulated';
  throw new PaymentProviderConfigurationError(
    `Proveedor de pago no soportado: ${value}.`,
  );
};
