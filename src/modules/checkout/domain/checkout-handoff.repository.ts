export const CHECKOUT_HANDOFF_REPOSITORY = Symbol(
  'CHECKOUT_HANDOFF_REPOSITORY',
);

export interface CheckoutHandoffRepository {
  create(
    cartId: string,
    tokenHash: string,
    token: string,
  ): Promise<{ token: string; expiresAt: Date }>;
  consume(tokenHash: string): Promise<{ cartId: string; cartToken: string }>;
}
