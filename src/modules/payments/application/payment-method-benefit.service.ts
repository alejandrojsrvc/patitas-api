import type { PaymentMethodBenefitRepository, TransferInstructions } from '../domain/payment-method-benefit.repository';
import { DomainError } from '../../../shared/domain/domain-error';

export class PaymentMethodBenefitValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_METHOD_BENEFIT_INVALID');
  }
}

export class PaymentMethodBenefitService {
  public constructor(private readonly repository: PaymentMethodBenefitRepository) {}

  public transfer() {
    return this.repository.transfer();
  }

  public async assertTransferAvailable() {
    const configuration = await this.repository.transfer();
    if (!configuration.enabled) throw new PaymentMethodBenefitValidationError('La transferencia no está habilitada en este momento.');
    if (!configuration.instructions) throw new PaymentMethodBenefitValidationError('La transferencia no tiene datos bancarios configurados.');
    return configuration;
  }

  public async updateTransfer(input: {
    enabled?: boolean;
    discountPercent?: string;
    expirationMinutes?: number;
    instructions?: TransferInstructions | null;
  }) {
    if (
      input.discountPercent !== undefined &&
      (!/^\d+(\.\d{1,2})?$/.test(input.discountPercent) || Number(input.discountPercent) < 0 || Number(input.discountPercent) > 100)
    )
      throw new PaymentMethodBenefitValidationError('El porcentaje de transferencia debe estar entre 0 y 100.');
    if (input.expirationMinutes !== undefined && (!Number.isInteger(input.expirationMinutes) || input.expirationMinutes <= 0))
      throw new PaymentMethodBenefitValidationError('El vencimiento de transferencia debe ser mayor a cero.');
    const current = await this.repository.transfer();
    const effectiveEnabled = input.enabled ?? current.enabled;
    const effectiveInstructions = input.instructions === undefined ? current.instructions : input.instructions;
    if (effectiveInstructions && !validTransferInstructions(effectiveInstructions))
      throw new PaymentMethodBenefitValidationError('Configurá titular, banco y alias o CBU para transferencia.');
    if (effectiveEnabled && !effectiveInstructions)
      throw new PaymentMethodBenefitValidationError('Los datos bancarios son obligatorios para habilitar transferencia.');
    return this.repository.updateTransfer(input);
  }
}

const validTransferInstructions = (value: TransferInstructions): boolean =>
  typeof value.accountHolder === 'string' &&
  Boolean(value.accountHolder.trim()) &&
  typeof value.bank === 'string' &&
  Boolean(value.bank.trim()) &&
  Boolean((typeof value.alias === 'string' && value.alias.trim()) || (typeof value.cbu === 'string' && value.cbu.trim()));
