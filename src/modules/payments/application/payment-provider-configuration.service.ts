import type { PaymentProviderName, PaymentProviderResolver } from '../../../shared/application/ports/payment-provider.interface';
import type { PaymentProviderConfigurationRepository } from '../domain/payment-provider-configuration.repository';
import { DomainError } from '../../../shared/domain/domain-error';
import type { PaymentMethodBenefitService } from './payment-method-benefit.service';

export class PaymentProviderConfigurationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_PROVIDER_CONFIGURATION_INVALID');
  }
}

const PAYMENT_METHODS: Record<PaymentProviderName, string> = {
  mercadopago: 'MERCADO_PAGO',
  payway: 'PAYWAY',
};

export class PaymentProviderConfigurationService {
  public constructor(
    private readonly repository: PaymentProviderConfigurationRepository,
    private readonly providers: PaymentProviderResolver,
    private readonly benefits?: PaymentMethodBenefitService,
  ) {}

  public list() {
    return this.repository.list();
  }

  public update(provider: string, input: { enabled?: boolean; priority?: number }) {
    return this.repository.update(normalizeProvider(provider), input);
  }

  public async availableMethods() {
    const configurations = await this.repository.list();
    const methods = configurations
      .filter((configuration) => configuration.enabled)
      .filter((configuration) => {
        try {
          const provider = this.providers.resolve(configuration.provider);
          provider.assertReady?.();
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
    const transfer = this.benefits ? await this.benefits.transfer() : null;
    if (!transfer?.enabled || !transfer.instructions) return methods;
    return [
      ...methods,
      {
        provider: 'manual_transfer',
        paymentMethod: 'BANK_TRANSFER',
        priority: 0,
        benefit: {
          percentage: transfer.discountPercent,
          description: 'Descuento por transferencia',
        },
        transfer: {
          expirationMinutes: transfer.expirationMinutes,
          instructions: transfer.instructions,
        },
      },
    ];
  }
}

export const normalizeProvider = (value: string): PaymentProviderName => {
  const normalized = value.trim().toLowerCase().replaceAll('-', '_');
  if (normalized === 'mercado_pago' || normalized === 'mercadopago') return 'mercadopago';
  if (normalized === 'payway') return 'payway';
  throw new PaymentProviderConfigurationError(`Proveedor de pago no soportado: ${value}.`);
};
