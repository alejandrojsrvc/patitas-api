export const GUEST_ORDER_ACTIVATION_REPOSITORY = Symbol('GUEST_ORDER_ACTIVATION_REPOSITORY');
export interface GuestActivationRecord {
  id: string;
  orderId: string;
  email: string;
}
export interface GuestOrderActivationRepository {
  findActive(tokenHash: string): Promise<GuestActivationRecord | null>;
  consumeAndLink(input: { tokenHash: string; userId: string; orderId: string; email: string }): Promise<string>;
}
