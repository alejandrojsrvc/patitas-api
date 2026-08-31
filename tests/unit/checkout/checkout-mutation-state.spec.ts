import { CheckoutService } from '../../../src/modules/checkout/application/checkout.service';
import { CheckoutConflictError } from '../../../src/modules/checkout/domain/checkout.error';
import type { CheckoutRepository } from '../../../src/modules/checkout/domain/checkout.repository';
import type { CheckoutSession } from '../../../src/modules/checkout/domain/checkout.types';

const session = {
  id: 'checkout-1',
  cartId: 'cart-1',
  customerId: 'customer-1',
  stage: 'SHIPPING',
  status: 'DRAFT',
  contactName: 'Cliente',
  contactEmail: 'cliente@example.com',
  contactPhone: null,
  shippingAddress: { postalCode: '1000' },
  deliveryInstructions: null,
  shippingOptionId: null,
  shippingCost: '0.00',
  shippingZoneId: null,
  shippingEstimate: null,
  shippingDeliverySlot: null,
  shippingDeliveryDate: null,
  paymentMethod: null,
  savedPaymentMethodId: null,
  couponCode: null,
  orderId: null,
  subtotal: '1000.00',
  discountTotal: '0.00',
  total: '1000.00',
  items: [],
  expiresAt: new Date(),
} satisfies CheckoutSession;

describe('CheckoutService mutation state', () => {
  it('returns session and shipping options after a checkout mutation', async () => {
    const repository = {
      applyCoupon: jest.fn().mockResolvedValue(session),
    } as unknown as CheckoutRepository;
    const service = new CheckoutService(repository);

    const result = await service.applyCouponWithState(
      'checkout-1',
      { customerId: 'customer-1' },
      'PATITAS',
    );

    expect(result).toEqual({ session, shippingOptions: [] });
  });

  it('attaches the current state to a recoverable conflict', async () => {
    const repository = {
      applyCoupon: jest
        .fn()
        .mockRejectedValue(new CheckoutConflictError('El checkout cambió.')),
      find: jest.fn().mockResolvedValue(session),
    } as unknown as CheckoutRepository;
    const service = new CheckoutService(repository);

    await expect(
      service.applyCouponWithState(
        'checkout-1',
        { customerId: 'customer-1' },
        'PATITAS',
      ),
    ).rejects.toMatchObject({
      code: 'CHECKOUT_CONFLICT',
      currentState: { session, shippingOptions: [] },
    });
  });
});
