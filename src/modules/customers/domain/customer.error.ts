import { DomainError } from '../../../shared/domain/domain-error';

export class CustomerNotFoundError extends DomainError {
  public constructor() {
    super('El cliente no existe.', 'CUSTOMER_NOT_FOUND');
  }
}

export class CustomerValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'CUSTOMER_VALIDATION_FAILED');
  }
}
