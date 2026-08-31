import type { CheckoutService } from '../../../src/modules/checkout/application/checkout.service';
import type { CustomerAddressService } from '../../../src/modules/customers/application/customer-address.service';
import type { CustomerService } from '../../../src/modules/customers/application/customer.service';
import type { PetService } from '../../../src/modules/pets/application/pet.service';
import type { ReplenishmentService } from '../../../src/modules/replenishment/application/replenishment.service';
import type { CartService } from '../../../src/modules/cart/application/cart.service';
import { AccountQueryService } from '../../../src/modules/storefront/application/account-query.service';
import { UserRole } from '../../../src/modules/users/domain/entities/user.entity';

describe('AccountQueryService', () => {
  it('reuses the address read and returns the requested account section', async () => {
    const listAddresses = jest
      .fn()
      .mockResolvedValue([{ id: 'address-1', label: 'Casa', isDefault: true }]);
    const service = new AccountQueryService(
      {
        findProfileByUserId: jest.fn().mockResolvedValue({
          id: 'customer-1',
          fullName: 'Cliente Uno',
        }),
      } as unknown as CustomerService,
      {
        listForUserByCustomerId: listAddresses,
      } as unknown as CustomerAddressService,
      {} as CheckoutService,
      {} as PetService,
      {} as ReplenishmentService,
      {
        findActiveSummary: jest.fn().mockResolvedValue(null),
      } as unknown as CartService,
    );

    const result = await service.getScreen({
      user: {
        userId: 'user-1',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
      },
      section: 'addresses',
    });

    expect(listAddresses).toHaveBeenCalledTimes(1);
    expect(result.shell.location).toEqual(
      expect.objectContaining({ label: 'Casa' }),
    );
    expect(result.section).toEqual({
      type: 'addresses',
      addresses: [expect.objectContaining({ id: 'address-1' })],
    });
  });

  it('loads only the requested order detail without listing all orders', async () => {
    const customerOrder = jest.fn().mockResolvedValue({ id: 'order-1' });
    const customerOrderPage = jest.fn();
    const service = new AccountQueryService(
      {
        findProfileByUserId: jest.fn().mockResolvedValue({
          id: 'customer-1',
          fullName: 'Cliente Uno',
        }),
      } as unknown as CustomerService,
      {
        listForUserByCustomerId: jest.fn().mockResolvedValue([]),
      } as unknown as CustomerAddressService,
      {
        customerOrder,
        customerOrderPage,
      } as unknown as CheckoutService,
      {} as PetService,
      {} as ReplenishmentService,
      {
        findActiveSummary: jest.fn().mockResolvedValue(null),
      } as unknown as CartService,
    );

    const result = await service.getScreen({
      user: {
        userId: 'user-1',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
      },
      section: 'orders',
      orderId: 'order-1',
    });

    expect(customerOrder).toHaveBeenCalledWith('customer-1', 'order-1');
    expect(customerOrderPage).not.toHaveBeenCalled();
    expect(result.section).toEqual({
      type: 'order-detail',
      order: { id: 'order-1' },
    });
  });
});
