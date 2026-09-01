import type { UserRole } from '../../users/domain/entities/user.entity';
import type { CheckoutService } from '../../checkout/application/checkout.service';
import type { CustomerAddressService } from '../../customers/application/customer-address.service';
import type { CustomerService } from '../../customers/application/customer.service';
import type { PetService } from '../../pets/application/pet.service';
import type { ReplenishmentService } from '../../replenishment/application/replenishment.service';
import type { CartService } from '../../cart/application/cart.service';
import {
  toAuthenticatedViewer,
  toCartSummary,
  toLocationSummary,
} from './storefront-shell';

export type AccountSection =
  'overview' | 'orders' | 'addresses' | 'pets' | 'replenishments';

export class AccountQueryService {
  public constructor(
    private readonly customers: CustomerService,
    private readonly addresses: CustomerAddressService,
    private readonly checkout: CheckoutService,
    private readonly pets: PetService,
    private readonly replenishments: ReplenishmentService,
    private readonly carts: CartService,
  ) {}

  public async getScreen(input: {
    user: { userId: string; email: string; role: UserRole };
    section: AccountSection;
    orderId?: string;
    page?: number;
    perPage?: number;
  }) {
    const customerService = this.customers as CustomerService & {
      ensureProfileByUserId?: CustomerService['ensureProfileByUserId'];
    };
    const profile = customerService.ensureProfileByUserId
      ? await customerService.ensureProfileByUserId(input.user.userId, {
          fullName: input.user.email,
          email: input.user.email,
        })
      : await this.customers.findProfileByUserId(input.user.userId);
    const addressesPromise = this.addresses.listForUserByCustomerId(profile.id);
    const [addresses, cart, section] = await Promise.all([
      addressesPromise,
      this.carts.findActiveSummary({ customerId: profile.id }),
      input.section === 'addresses'
        ? addressesPromise.then((items) => ({
            type: input.section,
            addresses: items,
          }))
        : this.loadSection(
            profile.id,
            input.section,
            input.orderId,
            input.page ?? 1,
            input.perPage ?? 10,
          ),
    ]);
    const defaultAddress =
      addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;

    return {
      shell: {
        viewer: toAuthenticatedViewer({
          ...input.user,
          displayName: profile.fullName,
        }),
        location: toLocationSummary(defaultAddress),
        cart: toCartSummary(cart),
      },
      profile,
      section,
    };
  }

  private async loadSection(
    customerId: string,
    section: AccountSection,
    orderId?: string,
    page = 1,
    perPage = 10,
  ) {
    if (section === 'pets') {
      return { type: section, pets: await this.pets.list(customerId) };
    }
    if (section === 'replenishments') {
      return {
        type: section,
        replenishments: await this.replenishments.list({ customerId }),
      };
    }

    if (orderId) {
      return {
        type: 'order-detail' as const,
        order: await this.checkout.customerOrder(customerId, orderId),
      };
    }
    const orders = await this.checkout.customerOrderPage(
      customerId,
      section === 'overview' ? 1 : page,
      section === 'overview' ? 3 : perPage,
    );
    if (section === 'overview') {
      return {
        type: section,
        orderCount: orders.total,
        recentOrders: orders.items,
      };
    }
    return {
      type: section,
      orders: orders.items,
      meta: {
        page: orders.page,
        perPage: orders.perPage,
        total: orders.total,
        totalPages: Math.ceil(orders.total / orders.perPage),
      },
    };
  }
}
