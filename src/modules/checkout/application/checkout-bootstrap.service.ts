import type { CustomerAddressService } from '../../customers/application/customer-address.service';
import type { PaymentProviderConfigurationService } from '../../payments/application/payment-provider-configuration.service';
import type { CheckoutOwner } from '../domain/checkout.types';
import type { CheckoutService } from './checkout.service';
import type { UserRole } from '../../users/domain/entities/user.entity';
import {
  toAuthenticatedViewer,
  toLocationSummary,
} from '../../storefront/application/storefront-shell';

export class CheckoutBootstrapService {
  public constructor(
    private readonly checkout: CheckoutService,
    private readonly addresses: CustomerAddressService,
    private readonly paymentConfigurations: PaymentProviderConfigurationService,
  ) {}

  public async get(input: {
    id: string;
    owner: CheckoutOwner;
    user?: { userId: string; email: string; role: UserRole };
  }) {
    const session = await this.checkout.find(input.id, input.owner);
    const [shippingOptions, paymentMethods, savedAddresses] = await Promise.all(
      [
        session.stage === 'CONTACT'
          ? Promise.resolve([])
          : this.checkout.shippingOptionsForSession(session),
        this.paymentConfigurations.availableMethods(),
        input.owner.customerId
          ? this.addresses.listForUserByCustomerId(input.owner.customerId)
          : Promise.resolve([]),
      ],
    );

    const defaultAddress =
      savedAddresses.find((address) => address.isDefault) ??
      savedAddresses[0] ??
      null;
    return {
      shell: {
        viewer: input.user
          ? toAuthenticatedViewer({
              ...input.user,
              displayName: session.contactName,
            })
          : { authenticated: false as const },
        location: toLocationSummary(defaultAddress),
        cart: {
          id: session.cartId,
          itemCount: session.items.reduce(
            (total, item) => total + item.quantity,
            0,
          ),
          subtotal: session.subtotal,
          currency: 'ARS' as const,
        },
      },
      session,
      shippingOptions: shippingOptions
        .filter((option) => option.available)
        .map(({ id, cost, deliverySlots }) => ({
          id,
          cost,
          deliverySlots,
        })),
      paymentMethods,
      savedAddresses,
    };
  }
}
