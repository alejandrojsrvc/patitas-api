import { DomainError } from '../../../shared/domain/domain-error';

export class OrderNotFoundError extends DomainError {
  public constructor() {
    super('El pedido no existe.', 'ORDER_NOT_FOUND');
  }
}

export class OrderValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'ORDER_VALIDATION_FAILED');
  }
}

export class OrderConflictError extends DomainError {
  public constructor(message: string) {
    super(message, 'ORDER_CONFLICT');
  }
}
