import { DomainError } from '../../../shared/domain/domain-error';
import type {
  PaymentRepository,
  PaymentOwner,
} from '../domain/payment.repository';
import type { MarketingService } from '../../marketing/application/marketing.service';
import type {
  PaymentProviderName,
  TokenizedCardPayment,
} from '../../../shared/domain/payment.types';
import type { PaymentWebhookReceipt } from '../../../shared/domain/payment.types';
import type { PaymentProviderResolver } from '../../../shared/application/ports/payment-provider.interface';
import type { PaymentProviderConfigurationRepository } from '../domain/payment-provider-configuration.repository';

export class PaymentValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_VALIDATION_FAILED');
  }
}

export class PaymentConflictError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_IDEMPOTENCY_CONFLICT');
  }
}

export class PaymentService {
  public constructor(
    private readonly repository: PaymentRepository,
    private readonly marketing?: MarketingService,
    private readonly providers?: PaymentProviderResolver,
    private readonly configurations?: PaymentProviderConfigurationRepository,
  ) {}

  public async assertMethodAvailable(
    paymentMethod: string | null,
  ): Promise<void> {
    if (paymentMethod === 'MERCADO_PAGO') {
      if (!this.providers)
        throw new PaymentValidationError('Proveedor no disponible.');
      await this.assertProvider('mercadopago');
      return;
    }
    if (paymentMethod === 'PAYWAY') {
      if (!this.providers)
        throw new PaymentValidationError('Proveedor no disponible.');
      await this.assertProvider('payway');
      return;
    }
    if (paymentMethod?.startsWith('SIMULATED_')) {
      if (
        this.configurations &&
        !(await this.configurations.isEnabled('simulated'))
      )
        throw new PaymentValidationError(
          'La pasarela simulated está deshabilitada en la configuración de pagos.',
        );
      return;
    }
    throw new PaymentValidationError('El método de pago no es válido.');
  }

  private async assertProvider(provider: PaymentProviderName): Promise<void> {
    if (this.configurations && !(await this.configurations.isEnabled(provider)))
      throw new PaymentValidationError(
        `La pasarela ${provider} está deshabilitada en la configuración de pagos.`,
      );
    try {
      this.providers?.resolve(provider);
    } catch {
      throw new PaymentValidationError(
        `La pasarela ${provider} no está habilitada. Configura PAYMENT_PROVIDERS=${provider} y sus credenciales en el entorno.`,
      );
    }
  }
  public initiate(
    orderId: string,
    owner: PaymentOwner,
    paymentMethod?: TokenizedCardPayment,
    idempotencyKey?: string,
  ) {
    if (!orderId) throw new PaymentValidationError('El pedido es obligatorio.');
    if (!idempotencyKey?.trim())
      throw new PaymentValidationError(
        'Idempotency-Key es obligatorio para iniciar un pago.',
      );
    return this.repository
      .initiate(orderId, owner, paymentMethod, idempotencyKey)
      .then(async (result) => {
        if (result.status === 'APPROVED' && this.marketing)
          await this.marketing.record({
            eventName: 'Purchase',
            eventId: result.orderId,
            source: 'server',
            orderId: result.orderId,
            currency: 'ARS',
          });
        return result;
      });
  }
  public refund(
    orderId: string,
    owner: PaymentOwner,
    amount: string | undefined,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim())
      throw new PaymentValidationError(
        'Idempotency-Key es obligatorio para solicitar un refund.',
      );
    return this.repository.refund(
      orderId,
      owner,
      amount,
      idempotencyKey.trim(),
    );
  }
  public status(orderId: string, owner: PaymentOwner) {
    return this.repository.status(orderId, owner);
  }
  public async webhook(input: {
    provider: PaymentProviderName;
    receipt: PaymentWebhookReceipt;
  }) {
    const result = await this.repository.handleWebhook(input);
    if (
      result.orderId &&
      result.status === 'APPROVED' &&
      !result.reconciliationRequired &&
      this.marketing
    )
      await this.marketing.record({
        eventName: 'Purchase',
        eventId: result.orderId,
        source: 'server',
        orderId: result.orderId,
        value: result.value,
        currency: 'ARS',
      });
    return result;
  }
}
