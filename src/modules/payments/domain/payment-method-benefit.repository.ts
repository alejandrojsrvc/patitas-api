export const PAYMENT_METHOD_BENEFIT_REPOSITORY = Symbol('PAYMENT_METHOD_BENEFIT_REPOSITORY');

export interface TransferInstructions {
  accountHolder: string;
  bank: string;
  alias: string | null;
  cbu: string | null;
  note: string | null;
}

export interface PaymentMethodBenefitConfiguration {
  id: string;
  paymentMethod: string;
  enabled: boolean;
  discountPercent: string;
  expirationMinutes: number;
  instructions: TransferInstructions | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethodBenefitRepository {
  transfer(): Promise<PaymentMethodBenefitConfiguration>;
  updateTransfer(input: {
    enabled?: boolean;
    discountPercent?: string;
    expirationMinutes?: number;
    instructions?: TransferInstructions | null;
  }): Promise<PaymentMethodBenefitConfiguration>;
}
