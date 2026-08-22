import type { CheckoutOwner, CheckoutSession, OrderSummary } from './checkout.types';

export const CHECKOUT_REPOSITORY = Symbol('CHECKOUT_REPOSITORY');

export interface CheckoutRepository {
  create(cartId: string, owner: CheckoutOwner): Promise<{ session: CheckoutSession; token: string }>;
  find(id: string, owner: CheckoutOwner): Promise<CheckoutSession>;
  setContact(id: string, owner: CheckoutOwner, input: { contactName: string; contactEmail: string; contactPhone?: string | null }): Promise<CheckoutSession>;
  setAddress(id: string, owner: CheckoutOwner, address: Record<string, string>): Promise<CheckoutSession>;
  setShippingOption(id: string, owner: CheckoutOwner, shippingOptionId: string): Promise<CheckoutSession>;
  setPaymentMethod(id: string, owner: CheckoutOwner, paymentMethod: string): Promise<CheckoutSession>;
  applyCoupon(id: string, owner: CheckoutOwner, code: string): Promise<CheckoutSession>;
  clearCoupon(id: string, owner: CheckoutOwner): Promise<CheckoutSession>;
  confirm(id: string, owner: CheckoutOwner): Promise<{ order: OrderSummary; publicToken: string; paymentRequired?: boolean }>;
  findPublicOrder(id: string, token: string): Promise<OrderSummary>;
  listCustomerOrders(customerId: string): Promise<OrderSummary[]>;
  findCustomerOrder(customerId: string, orderId: string): Promise<OrderSummary>;
}
