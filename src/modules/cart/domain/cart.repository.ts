import type { Cart, CartOwner, CartPage } from './cart.types';

export const CART_REPOSITORY = Symbol('CART_REPOSITORY');

export interface CartRepository {
  findActive(owner: CartOwner): Promise<Cart | null>;
  create(owner: CartOwner): Promise<Cart>;
  setItem(owner: CartOwner, variantId: string, quantity: number): Promise<Cart>;
  removeItem(owner: CartOwner, variantId: string): Promise<Cart>;
  merge(tokenHash: string, customerId: string): Promise<Cart>;
  listAbandoned(page: number, perPage: number): Promise<CartPage>;
}
