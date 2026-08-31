import type { CartSummary } from '../../cart/domain/cart.types';
import type { UserRole } from '../../users/domain/entities/user.entity';

export const emptyCartSummary = (): CartSummary => ({
  id: null,
  itemCount: 0,
  subtotal: '0.00',
  currency: 'ARS',
});

export const toCartSummary = (cart: CartSummary | null): CartSummary =>
  cart ?? emptyCartSummary();

export const toLocationSummary = <
  T extends {
    label: string;
    street: string;
    number: string;
    apartment: string | null;
    city: string;
    province: string;
    postalCode: string;
  },
>(
  address: T | null,
) =>
  address
    ? {
        label: address.label,
        street: address.street,
        number: address.number,
        apartment: address.apartment,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
      }
    : null;

export const toAuthenticatedViewer = (input: {
  userId: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
}) => ({
  authenticated: true as const,
  id: input.userId,
  email: input.email,
  displayName: input.displayName || input.email,
  role: input.role,
});
