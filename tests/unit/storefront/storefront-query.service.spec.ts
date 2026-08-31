import { StorefrontQueryService } from '../../../src/modules/storefront/application/storefront-query.service';
import type { CartService } from '../../../src/modules/cart/application/cart.service';
import type { CustomerAddressService } from '../../../src/modules/customers/application/customer-address.service';
import type { CustomerService } from '../../../src/modules/customers/application/customer.service';
import { UserRole } from '../../../src/modules/users/domain/entities/user.entity';

describe('StorefrontQueryService', () => {
  it('does not create or search an anonymous cart without a token', async () => {
    const findActiveSummary = jest.fn();
    const service = new StorefrontQueryService(
      {} as CustomerService,
      {} as CustomerAddressService,
      { findActiveSummary } as unknown as CartService,
    );

    const result = await service.bootstrap({});

    expect(findActiveSummary).not.toHaveBeenCalled();
    expect(result.viewer).toEqual({ authenticated: false });
    expect(result.cart).toEqual({
      id: null,
      itemCount: 0,
      subtotal: '0.00',
      currency: 'ARS',
    });
  });

  it('returns viewer, default location and cart summary in one read model', async () => {
    const customer = {
      id: 'customer-1',
      userId: 'user-1',
      fullName: 'Cliente Uno',
      email: 'customer@example.com',
      phone: null,
      avatarUrl: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = new StorefrontQueryService(
      {
        findProfileByUserId: jest.fn().mockResolvedValue(customer),
      } as unknown as CustomerService,
      {
        listForUserByCustomerId: jest.fn().mockResolvedValue([
          {
            label: 'Casa',
            street: 'Calle',
            number: '123',
            apartment: null,
            city: 'CABA',
            province: 'CABA',
            postalCode: '1000',
            isDefault: true,
          },
        ]),
      } as unknown as CustomerAddressService,
      {
        findActiveSummary: jest.fn().mockResolvedValue({
          id: 'cart-1',
          subtotal: '15000.00',
          currency: 'ARS',
          itemCount: 3,
        }),
      } as unknown as CartService,
    );

    const result = await service.bootstrap({
      user: {
        userId: 'user-1',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
      },
    });

    expect(result.viewer).toEqual(
      expect.objectContaining({
        authenticated: true,
        displayName: 'Cliente Uno',
      }),
    );
    expect(result.location).toEqual(
      expect.objectContaining({ label: 'Casa', street: 'Calle' }),
    );
    expect(result.cart).toEqual({
      id: 'cart-1',
      itemCount: 3,
      subtotal: '15000.00',
      currency: 'ARS',
    });
  });

  it('returns a null full cart without creating one in the cart screen', async () => {
    const findActive = jest.fn().mockResolvedValue(null);
    const service = new StorefrontQueryService(
      {} as CustomerService,
      {} as CustomerAddressService,
      { findActive } as unknown as CartService,
    );

    const result = await service.cartScreen({ cartToken: 'guest-token' });

    expect(findActive).toHaveBeenCalledTimes(1);
    expect(result.cart).toBeNull();
    expect(result.shell.cart).toEqual({
      id: null,
      itemCount: 0,
      subtotal: '0.00',
      currency: 'ARS',
    });
  });
});
