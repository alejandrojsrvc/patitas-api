import type { PaymentService } from '../../payments/application/payment.service';
import type { TokenizedCardPayment } from '../../../shared/domain/payment.types';
import type {
  CreateMobilePaymentMethodInput,
  MobilePaymentMethodRepository,
} from '../domain/mobile-payment-method.repository';
import { MobilePaymentMethodError } from '../domain/mobile-payment-method.repository';

export class MobilePaymentService {
  public constructor(
    private readonly payments: PaymentService,
    private readonly methods: MobilePaymentMethodRepository,
  ) {}

  public async listMethods(
    customerId: string,
    available: Array<{ provider: string; paymentMethod: string }>,
  ) {
    const saved = await this.methods.list(customerId);
    return {
      items: [
        ...saved.map((method) => ({
          id: method.id,
          type: 'SAVED_CARD',
          provider: providerName(method.provider),
          label:
            `${method.brand ?? 'Tarjeta'} •••• ${method.lastFour ?? ''}`.trim(),
          description: method.isDefault ? 'Predeterminada' : null,
          enabled: true,
          savedPaymentMethodId: method.id,
          benefit: null,
        })),
        ...available.map((method) => ({
          id: method.provider,
          type: methodType(method.paymentMethod),
          provider: providerName(method.provider),
          label: methodLabel(method.paymentMethod),
          description: methodDescription(method.paymentMethod),
          enabled: true,
          savedPaymentMethodId: null,
          benefit: null,
        })),
      ],
    };
  }

  public listSavedMethods(customerId: string) {
    return this.methods.list(customerId).then((methods) =>
      methods.map((method) => ({
        id: method.id,
        provider: providerName(method.provider),
        type: method.type,
        brand: method.brand?.toUpperCase() ?? null,
        lastFour: method.lastFour,
        expirationMonth: method.expirationMonth,
        expirationYear: method.expirationYear,
        isDefault: method.isDefault,
      })),
    );
  }

  public saveMethod(customerId: string, input: CreateMobilePaymentMethodInput) {
    if (!input.providerPaymentMethodId.trim())
      throw new MobilePaymentMethodError(
        'El ID del método de pago del proveedor es obligatorio.',
      );
    return this.methods.create(customerId, input);
  }

  public removeMethod(customerId: string, id: string) {
    return this.methods.remove(id, customerId);
  }

  public initiate(
    customerId: string,
    orderId: string,
    payment?: TokenizedCardPayment,
    idempotencyKey?: string,
  ) {
    return this.payments.initiate(
      orderId,
      { customerId },
      payment,
      idempotencyKey,
    );
  }

  public status(customerId: string, orderId: string) {
    return this.payments.status(orderId, { customerId });
  }
}

const methodType = (method: string): string =>
  method === 'MERCADO_PAGO' ? 'WALLET' : 'CARD';

const METHOD_LABELS: Record<string, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  PAYWAY: 'Tarjeta de crédito o débito',
  SIMULATED_CARD: 'Tarjeta simulada',
};

const methodLabel = (method: string): string => METHOD_LABELS[method] ?? method;

const methodDescription = (method: string): string =>
  method === 'MERCADO_PAGO'
    ? 'Pagá desde Mercado Pago'
    : 'El total se confirma antes de iniciar el pago';

const providerName = (provider: string): string =>
  provider.toLowerCase() === 'mercadopago'
    ? 'MERCADO_PAGO'
    : provider.toUpperCase();
