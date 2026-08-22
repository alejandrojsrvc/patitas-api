import { createAnonymousToken, hashAnonymousToken } from '../../../shared/application/anonymous-token';
import type { CartRepository } from '../domain/cart.repository';
import type { Cart, CartOwner } from '../domain/cart.types';
import { CartValidationError } from '../domain/cart.error';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';

export class CartService {
  public constructor(private readonly repository: CartRepository, private readonly storage?: StorageProvider) {}

  public async getOrCreate(owner: CartOwner): Promise<{ cart: Cart; token?: string }> {
    const token = owner.customerId || owner.tokenHash ? undefined : createAnonymousToken();
    const resolvedOwner = token ? { ...owner, tokenHash: hashAnonymousToken(token) } : owner;
    const existing = await this.repository.findActive(resolvedOwner);
    if (existing) return { cart: await this.resolveMedia(existing), ...(token ? { token } : {}) };
    const cart = await this.repository.create(resolvedOwner);
    return { cart: await this.resolveMedia(cart), ...(token ? { token } : {}) };
  }

  public async setItem(owner: CartOwner, variantId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new CartValidationError('La cantidad debe estar entre 1 y 99.');
    }
    const current = await this.getOrCreate(owner);
    const resolvedOwner = owner.customerId || owner.tokenHash ? owner : { tokenHash: hashAnonymousToken(current.token!) };
    const cart = await this.resolveMedia(await this.repository.setItem(resolvedOwner, variantId, quantity));
    return { ...cart, ...(current.token ? { cartToken: current.token } : {}) };
  }

  public async removeItem(owner: CartOwner, variantId: string) {
    const current = await this.getOrCreate(owner);
    const resolvedOwner = owner.customerId || owner.tokenHash ? owner : { tokenHash: hashAnonymousToken(current.token!) };
    const cart = await this.resolveMedia(await this.repository.removeItem(resolvedOwner, variantId));
    return { ...cart, ...(current.token ? { cartToken: current.token } : {}) };
  }

  public merge(token: string, customerId: string) {
    return this.repository.merge(hashAnonymousToken(token), customerId);
  }

  public listAbandoned(page: number, perPage: number) {
    return this.repository.listAbandoned(page, perPage);
  }

  private async resolveMedia(cart: Cart): Promise<Cart> {
    if (!this.storage) return cart;
    return { ...cart, items: await Promise.all(cart.items.map(async (item) => ({ ...item, imageUrl: item.imageUrl && !/^https?:\/\//i.test(item.imageUrl) ? await this.storage!.getSignedUrl({ bucket: 'product-media', path: item.imageUrl }, 3_600) : item.imageUrl }))) };
  }
}
