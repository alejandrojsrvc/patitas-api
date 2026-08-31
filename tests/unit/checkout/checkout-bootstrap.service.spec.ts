import { CheckoutBootstrapService } from '../../../src/modules/checkout/application/checkout-bootstrap.service';
import type { CheckoutService } from '../../../src/modules/checkout/application/checkout.service';
import type { CustomerAddressService } from '../../../src/modules/customers/application/customer-address.service';
import type { PaymentProviderConfigurationService } from '../../../src/modules/payments/application/payment-provider-configuration.service';
import { UserRole } from '../../../src/modules/users/domain/entities/user.entity';

describe('CheckoutBootstrapService', () => {
  it('loads the session once and composes checkout dependencies in parallel', async () => {
    const session = {
      id: 'checkout-1',
      stage: 'SHIPPING',
      cartId: 'cart-1',
      contactName: 'Cliente Uno',
      subtotal: '25000.00',
      items: [{ quantity: 2 }],
    };
    const find = jest.fn().mockResolvedValue(session);
    const shippingOptionsForSession = jest.fn().mockResolvedValue([
      {
        id: 'standard',
        available: true,
        cost: '3000.00',
        deliverySlots: [],
        internalReason: 'must-not-leak',
      },
      { id: 'disabled', available: false, cost: '0.00', deliverySlots: [] },
    ]);
    const service = new CheckoutBootstrapService(
      {
        find,
        shippingOptionsForSession,
      } as unknown as CheckoutService,
      {
        listForUserByCustomerId: jest
          .fn()
          .mockResolvedValue([{ id: 'address-1' }]),
      } as unknown as CustomerAddressService,
      {
        availableMethods: jest.fn().mockResolvedValue([{ id: 'payway' }]),
      } as unknown as PaymentProviderConfigurationService,
    );

    const result = await service.get({
      id: 'checkout-1',
      owner: { customerId: 'customer-1' },
      user: {
        userId: 'user-1',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
      },
    });

    expect(find).toHaveBeenCalledTimes(1);
    expect(shippingOptionsForSession).toHaveBeenCalledWith(session);
    expect(result.shippingOptions).toEqual([
      { id: 'standard', cost: '3000.00', deliverySlots: [] },
    ]);
    expect(result.shell.cart).toEqual({
      id: 'cart-1',
      itemCount: 2,
      subtotal: '25000.00',
      currency: 'ARS',
    });
  });
});
