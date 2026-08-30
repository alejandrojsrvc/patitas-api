import { CartService } from '../../../src/modules/cart/application/cart.service';
import type { CartRepository } from '../../../src/modules/cart/domain/cart.repository';
import type { Cart } from '../../../src/modules/cart/domain/cart.types';

const cart: Cart = {
  id: 'cart-1',
  customerId: 'customer-1',
  source: 'MOBILE',
  status: 'ACTIVE',
  currency: 'ARS',
  subtotal: '100.00',
  lastActivityAt: new Date(),
  items: [],
};

describe('CartService Mobile context', () => {
  it('reorders into the contextual cart and preserves the main line context', async () => {
    const reorderItem = jest.fn().mockResolvedValue(cart);
    const repository = {
      findActive: jest.fn().mockResolvedValue(cart),
      reorderItem,
    } as unknown as CartRepository;
    const service = new CartService(repository);

    await service.reorder(
      { customerId: 'customer-1', source: 'MOBILE' },
      'variant-1',
      { role: 'MAIN', petId: 'pet-1', planId: 'plan-1' },
    );

    expect(reorderItem).toHaveBeenCalledWith(
      { customerId: 'customer-1', source: 'MOBILE' },
      'variant-1',
      1,
      { role: 'MAIN', petId: 'pet-1', planId: 'plan-1' },
    );
  });

  it('keeps Web cart operations on the STORE source by default', async () => {
    const findActive = jest.fn().mockResolvedValue(cart);
    const repository = { findActive } as unknown as CartRepository;
    const service = new CartService(repository);

    await service.getOrCreate({ customerId: 'customer-1' });

    expect(findActive).toHaveBeenCalledWith({ customerId: 'customer-1' });
  });
});
