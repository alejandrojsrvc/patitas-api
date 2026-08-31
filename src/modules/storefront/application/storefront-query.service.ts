import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import type { CartService } from '../../cart/application/cart.service';
import type { CustomerAddressService } from '../../customers/application/customer-address.service';
import type { CustomerService } from '../../customers/application/customer.service';
import type { UserRole } from '../../users/domain/entities/user.entity';
import {
  emptyCartSummary,
  toAuthenticatedViewer,
  toLocationSummary,
} from './storefront-shell';

export class StorefrontQueryService {
  public constructor(
    private readonly customers: CustomerService,
    private readonly addresses: CustomerAddressService,
    private readonly carts: CartService,
  ) {}

  public async bootstrap(input: {
    user?: { userId: string; email: string; role: UserRole };
    cartToken?: string;
  }) {
    return (await this.resolve(input)).shell;
  }

  public async cartScreen(input: {
    user?: { userId: string; email: string; role: UserRole };
    cartToken?: string;
  }) {
    const context = await this.resolve(input, true);
    return { shell: context.shell, cart: context.cart };
  }

  private async resolve(
    input: {
      user?: { userId: string; email: string; role: UserRole };
      cartToken?: string;
    },
    includeFullCart = false,
  ) {
    const customer = input.user
      ? await this.customers.findProfileByUserId(input.user.userId)
      : null;
    const owner = customer
      ? { customerId: customer.id }
      : input.cartToken
        ? { tokenHash: hashAnonymousToken(input.cartToken) }
        : {};
    const [addresses, cart] = await Promise.all([
      customer
        ? this.addresses.listForUserByCustomerId(customer.id)
        : Promise.resolve([]),
      customer || input.cartToken
        ? includeFullCart
          ? this.carts.findActive(owner)
          : this.carts.findActiveSummary(owner)
        : Promise.resolve(null),
    ]);
    const defaultAddress =
      addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;

    const cartSummary = cart
      ? includeFullCart
        ? {
            id: cart.id,
            itemCount:
              'items' in cart
                ? cart.items.reduce((total, item) => total + item.quantity, 0)
                : cart.itemCount,
            subtotal: cart.subtotal,
            currency: cart.currency,
          }
        : cart
      : emptyCartSummary();
    return {
      cart: includeFullCart && cart && 'items' in cart ? cart : null,
      shell: {
        viewer: input.user
          ? toAuthenticatedViewer({
              ...input.user,
              displayName: customer?.fullName,
            })
          : { authenticated: false as const },
        location: toLocationSummary(defaultAddress),
        cart: cartSummary,
      },
    };
  }
}
