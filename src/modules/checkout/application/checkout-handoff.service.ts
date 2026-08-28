import {
  createAnonymousToken,
  hashAnonymousToken,
} from '../../../shared/application/anonymous-token';
import type { CheckoutHandoffRepository } from '../domain/checkout-handoff.repository';

export class CheckoutHandoffService {
  public constructor(private readonly repository: CheckoutHandoffRepository) {}

  public create(cartId: string) {
    const token = createAnonymousToken();
    return this.repository.create(cartId, hashAnonymousToken(token), token);
  }

  public consume(token: string) {
    return this.repository.consume(hashAnonymousToken(token));
  }
}
