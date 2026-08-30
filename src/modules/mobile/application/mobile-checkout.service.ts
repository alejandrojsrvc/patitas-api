import type { CustomerAddress } from '../../customers/domain/customer.types';
import type { CustomerAddressService } from '../../customers/application/customer-address.service';
import type { CheckoutService } from '../../checkout/application/checkout.service';
import { CheckoutValidationError } from '../../checkout/domain/checkout.error';
import type { MobilePaymentMethodRepository } from '../domain/mobile-payment-method.repository';

export class MobileCheckoutService {
  public constructor(
    private readonly checkout: CheckoutService,
    private readonly addresses: CustomerAddressService,
    private readonly savedMethods: MobilePaymentMethodRepository,
  ) {}

  public create(customerId: string, cartId: string) {
    return this.checkout.create(cartId, { customerId, source: 'MOBILE' });
  }

  public find(customerId: string, id: string) {
    return this.checkout.find(id, { customerId, source: 'MOBILE' });
  }

  public contact(
    customerId: string,
    id: string,
    input: {
      contactName: string;
      contactEmail: string;
      contactPhone?: string | null;
    },
  ) {
    return this.checkout.setContact(
      id,
      { customerId, source: 'MOBILE' },
      input,
    );
  }

  public async address(
    customerId: string,
    id: string,
    input: {
      addressId?: string;
      address?: Record<string, string>;
      deliveryInstructions?: string | null;
    },
  ) {
    if (input.addressId && input.address)
      throw new CheckoutValidationError(
        'Usa addressId o address, no ambos a la vez.',
      );
    const address = input.addressId
      ? await this.findAddress(customerId, input.addressId)
      : input.address;
    if (!address)
      throw new CheckoutValidationError(
        'Se requiere una dirección guardada o una dirección completa.',
      );
    return this.checkout.setAddress(
      id,
      { customerId, source: 'MOBILE' },
      address,
      input.deliveryInstructions?.trim() || null,
    );
  }

  public shippingOption(
    customerId: string,
    id: string,
    shippingOptionId: string,
    deliverySlotId?: string,
  ) {
    return this.checkout.setShippingOption(
      id,
      { customerId, source: 'MOBILE' },
      shippingOptionId,
      deliverySlotId,
    );
  }

  public async paymentMethod(
    customerId: string,
    id: string,
    input: { paymentMethod?: string; savedPaymentMethodId?: string },
  ) {
    const saved = input.savedPaymentMethodId
      ? await this.savedMethods.findOwned(
          input.savedPaymentMethodId,
          customerId,
        )
      : null;
    if (input.savedPaymentMethodId && !saved)
      throw new CheckoutValidationError(
        'El método de pago guardado no existe o no tienes acceso.',
      );
    const paymentMethod =
      input.paymentMethod ?? (saved ? methodForProvider(saved.provider) : null);
    if (!paymentMethod)
      throw new CheckoutValidationError('Se requiere un método de pago.');
    return this.checkout.setPaymentMethod(
      id,
      { customerId, source: 'MOBILE' },
      paymentMethod,
      saved?.id ?? null,
    );
  }

  public coupon(customerId: string, id: string, code: string) {
    return this.checkout.applyCoupon(
      id,
      { customerId, source: 'MOBILE' },
      code,
    );
  }

  public clearCoupon(customerId: string, id: string) {
    return this.checkout.clearCoupon(id, { customerId, source: 'MOBILE' });
  }

  public confirm(
    customerId: string,
    id: string,
    payment: Parameters<CheckoutService['confirm']>[2],
    idempotencyKey?: string,
  ) {
    return this.checkout.confirm(
      id,
      { customerId, source: 'MOBILE' },
      payment,
      idempotencyKey,
    );
  }

  private async findAddress(
    customerId: string,
    addressId: string,
  ): Promise<Record<string, string>> {
    const address = (
      await this.addresses.listForUserByCustomerId(customerId)
    ).find((item) => item.id === addressId);
    if (!address)
      throw new CheckoutValidationError(
        'La dirección no existe o no tienes acceso.',
      );
    return addressToShippingAddress(address);
  }
}

const methodForProvider = (provider: string): string | null =>
  ({
    simulated: 'SIMULATED_CARD',
    mercadopago: 'MERCADO_PAGO',
    payway: 'PAYWAY',
  })[provider.toLowerCase()] ?? null;

const addressToShippingAddress = (
  address: CustomerAddress,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries({
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      street: address.street,
      number: address.number,
      apartment: address.apartment,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      reference: address.reference,
    }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
