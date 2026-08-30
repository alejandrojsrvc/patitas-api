import { toMobileCart } from '../../../src/modules/cart/presentation/mobile-cart.mapper';
import type { Cart } from '../../../src/modules/cart/domain/cart.types';

describe('Mobile cart mapper', () => {
  it('returns the native cart contract with item context', () => {
    const cart: Cart = {
      id: 'cart-id',
      customerId: 'customer-id',
      source: 'MOBILE',
      status: 'ACTIVE',
      currency: 'ARS',
      subtotal: '82400.00',
      lastActivityAt: new Date('2026-08-29T12:00:00.000Z'),
      items: [
        {
          id: 'item-id',
          productId: 'product-id',
          variantId: 'variant-id',
          productName: 'Excellent Adult',
          slug: 'excellent-adult',
          sku: 'EXC-15',
          presentation: '15 kg',
          imageUrl: null,
          unitPrice: '82400.00',
          quantity: 1,
          lineTotal: '82400.00',
          availableQuantity: 2,
          role: 'MAIN',
          petId: 'pet-id',
          planId: 'plan-id',
        },
      ],
    };

    expect(toMobileCart(cart)).toMatchObject({
      id: 'cart-id',
      subtotal: '82400.00',
      items: [
        {
          productId: 'product-id',
          variantId: 'variant-id',
          purchasable: true,
          availability: 'TODAY',
          context: { role: 'MAIN', petId: 'pet-id', planId: 'plan-id' },
        },
      ],
    });
  });
});
