import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { CheckoutValidationError } from '../domain/checkout.error';
import type { CheckoutOwner } from '../domain/checkout.types';
import type { CheckoutRepository } from '../domain/checkout.repository';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';
import type { PaymentService } from '../../payments/application/payment.service';

export class CheckoutService {
  public constructor(private readonly repository: CheckoutRepository, private readonly storage?: StorageProvider, private readonly payments?: PaymentService) {}

  public async create(cartId: string, owner: CheckoutOwner) { const result = await this.repository.create(cartId, owner); return { ...result, session: await this.resolveMedia(result.session) }; }
  public async find(id: string, owner: CheckoutOwner) { return this.resolveMedia(await this.repository.find(id, owner)); }
  public setContact(id: string, owner: CheckoutOwner, input: { contactName: string; contactEmail: string; contactPhone?: string | null }) {
    if (!input.contactName.trim() || !/^\S+@\S+\.\S+$/.test(input.contactEmail.trim())) throw new CheckoutValidationError('Los datos de contacto no son válidos.');
    return this.repository.setContact(id, owner, { ...input, contactName: input.contactName.trim(), contactEmail: input.contactEmail.trim().toLowerCase() }).then((session) => this.resolveMedia(session));
  }
  public setAddress(id: string, owner: CheckoutOwner, address: Record<string, string>) {
    const required = ['recipientName', 'street', 'number', 'city', 'province', 'postalCode'];
    if (required.some((key) => !address[key]?.trim())) throw new CheckoutValidationError('La dirección de envío está incompleta.');
    return this.repository.setAddress(id, owner, address).then((session) => this.resolveMedia(session));
  }
  public setShippingOption(id: string, owner: CheckoutOwner, shippingOptionId: string) { return this.repository.setShippingOption(id, owner, shippingOptionId).then((session) => this.resolveMedia(session)); }
  public setPaymentMethod(id: string, owner: CheckoutOwner, paymentMethod: string) {
    if (!['SIMULATED_CARD', 'SIMULATED_TRANSFER', 'SIMULATED_CASH', 'MERCADO_PAGO'].includes(paymentMethod)) throw new CheckoutValidationError('El método de pago no es válido.');
    return this.repository.setPaymentMethod(id, owner, paymentMethod).then((session) => this.resolveMedia(session));
  }
  public applyCoupon(id: string, owner: CheckoutOwner, code: string) { if (!code.trim()) throw new CheckoutValidationError('El cupón es obligatorio.'); return this.repository.applyCoupon(id, owner, code).then((session) => this.resolveMedia(session)); }
  public clearCoupon(id: string, owner: CheckoutOwner) { return this.repository.clearCoupon(id, owner).then((session) => this.resolveMedia(session)); }
  public async confirm(id: string, owner: CheckoutOwner) {
    const result = await this.repository.confirm(id, owner);
    if (!result.paymentRequired || !this.payments) return result;
    const link = await this.payments.createLink(result.order.id, owner.customerId ? { customerId: owner.customerId } : { publicTokenHash: hashAnonymousToken(result.publicToken) });
    return { ...result, payment: link };
  }
  public publicOrder(id: string, token: string) { return this.repository.findPublicOrder(id, hashAnonymousToken(token)); }
  public customerOrders(customerId: string) { return this.repository.listCustomerOrders(customerId); }
  public customerOrder(customerId: string, orderId: string) { return this.repository.findCustomerOrder(customerId, orderId); }

  private async resolveMedia<T extends { items: Array<{ imageUrl: string | null }> }>(session: T): Promise<T> {
    if (!this.storage) return session;
    return { ...session, items: await Promise.all(session.items.map(async (item) => ({ ...item, imageUrl: item.imageUrl && !/^https?:\/\//i.test(item.imageUrl) ? await this.storage!.getSignedUrl({ bucket: 'product-media', path: item.imageUrl }, 3_600) : item.imageUrl }))) };
  }
}
