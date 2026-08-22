export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentOwner {
  customerId?: string;
  publicTokenHash?: string;
}

export interface PaymentLink {
  orderId: string;
  provider: string;
  paymentUrl: string;
  preferenceId: string | null;
  status: string;
  expiresAt: Date | null;
}

export interface PaymentRepository {
  createLink(orderId: string, owner: PaymentOwner): Promise<PaymentLink>;
  handleWebhook(input: { headers: Record<string, string | string[] | undefined>; body: unknown }): Promise<{ accepted: boolean; duplicate: boolean; orderId?: string; status?: string; value?: string }>;
}
