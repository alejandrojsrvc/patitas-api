import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import {
  CheckoutConflictError,
  CheckoutValidationError,
} from '../domain/checkout.error';
import type { CheckoutOwner, CheckoutSession } from '../domain/checkout.types';
import type { CheckoutRepository } from '../domain/checkout.repository';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';
import type { PaymentService } from '../../payments/application/payment.service';
import type { TokenizedCardPayment } from '../../../shared/domain/payment.types';
import { PaymentValidationError } from '../../payments/application/payment.service';
import type { ShippingService } from '../../shipping/application/shipping.service';
import type { ShippingOptionQuote } from '../../shipping/domain/shipping.types';

export class CheckoutService {
  public constructor(
    private readonly repository: CheckoutRepository,
    private readonly storage?: StorageProvider,
    private readonly payments?: PaymentService,
    private readonly shipping?: ShippingService,
  ) {}

  public async create(cartId: string, owner: CheckoutOwner) {
    const result = await this.repository.create(cartId, owner);
    return { ...result, session: await this.resolveMedia(result.session) };
  }
  public async find(id: string, owner: CheckoutOwner) {
    return this.resolveMedia(await this.repository.find(id, owner));
  }
  public async shippingOptions(
    id: string,
    owner: CheckoutOwner,
  ): Promise<ShippingOptionQuote[]> {
    const session = await this.repository.find(id, owner);
    return this.shippingOptionsForSession(session);
  }
  public async shippingOptionsForSession(session: {
    shippingAddress: Record<string, string> | null;
    subtotal: string;
    discountTotal: string;
    items: Array<{
      weightGrams?: number | null;
      quantity: number;
      availableQuantity: number;
    }>;
  }): Promise<ShippingOptionQuote[]> {
    if (!this.shipping) return [];
    const address = session.shippingAddress ?? {};
    const weightGrams = session.items.reduce<number | undefined>(
      (total, item) =>
        total === undefined ||
        item.weightGrams === null ||
        item.weightGrams === undefined
          ? undefined
          : total + item.weightGrams * item.quantity,
      0,
    );
    return this.shipping.quoteOptions({
      postalCode: address.postalCode,
      neighborhood: address.neighborhood,
      city: address.city,
      province: address.province,
      subtotal: Math.max(
        0,
        Number(session.subtotal) - Number(session.discountTotal),
      ).toFixed(2),
      weightGrams,
      stockAvailable: session.items.every(
        (item) => item.availableQuantity >= item.quantity,
      ),
    });
  }
  public setContact(
    id: string,
    owner: CheckoutOwner,
    input: {
      contactName: string;
      contactEmail: string;
      contactPhone?: string | null;
    },
  ) {
    if (
      !input.contactName.trim() ||
      !/^\S+@\S+\.\S+$/.test(input.contactEmail.trim())
    )
      throw new CheckoutValidationError(
        'Los datos de contacto no son válidos.',
      );
    return this.repository
      .setContact(id, owner, {
        ...input,
        contactName: input.contactName.trim(),
        contactEmail: input.contactEmail.trim().toLowerCase(),
      })
      .then((session) => this.resolveMedia(session));
  }
  public async setContactWithState(
    id: string,
    owner: CheckoutOwner,
    input: {
      contactName: string;
      contactEmail: string;
      contactPhone?: string | null;
    },
  ) {
    return this.recoverableMutation(id, owner, () =>
      this.setContact(id, owner, input),
    );
  }
  public setAddress(
    id: string,
    owner: CheckoutOwner,
    address: Record<string, string>,
    deliveryInstructions?: string | null,
  ) {
    const required = [
      'recipientName',
      'street',
      'number',
      'city',
      'province',
      'postalCode',
    ];
    if (required.some((key) => !address[key]?.trim()))
      throw new CheckoutValidationError(
        'La dirección de envío está incompleta.',
      );
    return this.repository
      .setAddress(id, owner, address, deliveryInstructions)
      .then((session) => this.resolveMedia(session));
  }
  public async setAddressWithState(
    id: string,
    owner: CheckoutOwner,
    address: Record<string, string>,
  ) {
    return this.recoverableMutation(id, owner, async () => {
      let session = await this.setAddress(id, owner, address);
      let shippingOptions = await this.publicShippingOptions(session);
      if (shippingOptions.length === 1) {
        const onlyOption = shippingOptions[0];
        const deliverySlotId =
          onlyOption.deliverySlots.length === 1
            ? onlyOption.deliverySlots[0].id
            : undefined;
        if (onlyOption.deliverySlots.length <= 1) {
          session = await this.setShippingOption(
            id,
            owner,
            onlyOption.id,
            deliverySlotId,
          );
          shippingOptions = await this.publicShippingOptions(session);
        }
      }
      return { session, shippingOptions };
    });
  }
  public setShippingOption(
    id: string,
    owner: CheckoutOwner,
    shippingOptionId: string,
    deliverySlotId?: string,
  ) {
    return this.repository
      .setShippingOption(id, owner, shippingOptionId, deliverySlotId)
      .then((session) => this.resolveMedia(session));
  }
  public async setShippingOptionWithState(
    id: string,
    owner: CheckoutOwner,
    shippingOptionId: string,
    deliverySlotId?: string,
  ) {
    return this.recoverableMutation(id, owner, () =>
      this.setShippingOption(id, owner, shippingOptionId, deliverySlotId),
    );
  }
  public setPaymentMethod(
    id: string,
    owner: CheckoutOwner,
    paymentMethod: string,
    savedPaymentMethodId?: string | null,
  ) {
    if (
      ![
        'SIMULATED_CARD',
        'SIMULATED_TRANSFER',
        'SIMULATED_CASH',
        'MERCADO_PAGO',
        'PAYWAY',
      ].includes(paymentMethod)
    )
      throw new CheckoutValidationError('El método de pago no es válido.');
    return this.repository
      .setPaymentMethod(id, owner, paymentMethod, savedPaymentMethodId)
      .then((session) => this.resolveMedia(session));
  }
  public async setPaymentMethodWithState(
    id: string,
    owner: CheckoutOwner,
    paymentMethod: string,
  ) {
    return this.recoverableMutation(id, owner, () =>
      this.setPaymentMethod(id, owner, paymentMethod),
    );
  }
  public applyCoupon(id: string, owner: CheckoutOwner, code: string) {
    if (!code.trim())
      throw new CheckoutValidationError('El cupón es obligatorio.');
    return this.repository
      .applyCoupon(id, owner, code)
      .then((session) => this.resolveMedia(session));
  }
  public async applyCouponWithState(
    id: string,
    owner: CheckoutOwner,
    code: string,
  ) {
    return this.recoverableMutation(id, owner, () =>
      this.applyCoupon(id, owner, code),
    );
  }
  public clearCoupon(id: string, owner: CheckoutOwner) {
    return this.repository
      .clearCoupon(id, owner)
      .then((session) => this.resolveMedia(session));
  }
  public async clearCouponWithState(id: string, owner: CheckoutOwner) {
    return this.recoverableMutation(id, owner, () =>
      this.clearCoupon(id, owner),
    );
  }

  public async mutationState(session: CheckoutSession) {
    return {
      session,
      shippingOptions: await this.publicShippingOptions(session),
    };
  }
  public async confirm(
    id: string,
    owner: CheckoutOwner,
    paymentMethod?: TokenizedCardPayment,
    idempotencyKey?: string,
  ) {
    const session = await this.repository.find(id, owner);
    if (session.status !== 'COMPLETED' && this.payments)
      await this.payments.assertMethodAvailable(session.paymentMethod);
    if (
      session.status !== 'COMPLETED' &&
      ['MERCADO_PAGO', 'PAYWAY'].includes(session.paymentMethod ?? '') &&
      !idempotencyKey?.trim()
    )
      throw new PaymentValidationError(
        'Idempotency-Key es obligatorio para iniciar un pago externo.',
      );
    if (
      session.status !== 'COMPLETED' &&
      session.paymentMethod === 'PAYWAY' &&
      !paymentMethod
    )
      throw new CheckoutValidationError(
        'Payway requiere el token de tarjeta generado por el frontend.',
      );
    const result = await this.repository.confirm(id, owner);
    if (!result.paymentRequired || !this.payments) return result;
    const payment = await this.payments.initiate(
      result.order.id,
      owner.customerId
        ? { customerId: owner.customerId }
        : { publicTokenHash: hashAnonymousToken(result.publicToken) },
      paymentMethod,
      idempotencyKey,
    );
    return {
      ...result,
      order:
        payment.status === 'APPROVED' && payment.paymentStatus === 'PAID'
          ? { ...result.order, status: 'PAID', paymentStatus: 'PAID' }
          : {
              ...result.order,
              paymentStatus: payment.status,
              canRetry: payment.canRetry,
            },
      payment,
    };
  }
  public publicOrder(id: string, token: string) {
    return this.repository.findPublicOrder(id, hashAnonymousToken(token));
  }
  public customerOrders(customerId: string) {
    return this.repository.listCustomerOrders(customerId);
  }
  public customerOrderPage(customerId: string, page: number, perPage: number) {
    return this.repository.listCustomerOrderPage(customerId, page, perPage);
  }
  public customerOrder(customerId: string, orderId: string) {
    return this.repository.findCustomerOrder(customerId, orderId);
  }
  public petPurchaseHistory(customerId: string, petId: string) {
    return this.repository.findPetPurchaseHistory(customerId, petId);
  }

  private resolveMedia<T extends { items: Array<{ imageUrl: string | null }> }>(
    session: T,
  ): Promise<T> {
    const storage = this.storage;
    if (!storage) return Promise.resolve(session);
    return Promise.resolve({
      ...session,
      items: session.items.map((item) => ({
        ...item,
        imageUrl:
          item.imageUrl && !/^https?:\/\//i.test(item.imageUrl)
            ? storage.getPublicUrl({
                bucket: 'product-media',
                path: item.imageUrl,
              })
            : item.imageUrl,
      })),
    });
  }

  private async recoverableMutation(
    id: string,
    owner: CheckoutOwner,
    operation: () => Promise<
      | CheckoutSession
      | {
          session: CheckoutSession;
          shippingOptions: Array<{
            id: string;
            cost: string;
            deliverySlots: ShippingOptionQuote['deliverySlots'];
          }>;
        }
    >,
  ) {
    try {
      const result = await operation();
      return 'session' in result ? result : this.mutationState(result);
    } catch (error) {
      if (!(error instanceof CheckoutConflictError)) throw error;
      try {
        const current = await this.find(id, owner);
        throw new CheckoutConflictError(
          error.message,
          await this.mutationState(current),
        );
      } catch (recoveryError) {
        if (
          recoveryError instanceof CheckoutConflictError &&
          recoveryError.currentState
        )
          throw recoveryError;
        throw error;
      }
    }
  }

  private async publicShippingOptions(session: CheckoutSession) {
    if (session.stage === 'CONTACT') return [];
    return (await this.shippingOptionsForSession(session))
      .filter((option) => option.available)
      .map(({ id, cost, deliverySlots }) => ({ id, cost, deliverySlots }));
  }
}
