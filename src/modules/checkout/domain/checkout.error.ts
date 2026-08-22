import { DomainError } from '../../../shared/domain/domain-error';

export class CheckoutNotFoundError extends DomainError {
  public constructor(message = 'La sesión de checkout no existe.') {
    super(message, 'CHECKOUT_NOT_FOUND');
  }
}

export class CheckoutConflictError extends DomainError {
  public constructor(message: string) {
    super(message, 'CHECKOUT_CONFLICT');
  }
}

export class CheckoutValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'CHECKOUT_VALIDATION_FAILED');
  }
}
