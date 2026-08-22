import { DomainError } from '../../../shared/domain/domain-error';

export class CartValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'CART_VALIDATION_FAILED');
  }
}
