import { DomainError } from '../../../shared/domain/domain-error';

export class PromotionNotFoundError extends DomainError {
  public constructor(message = 'La promoción no existe.') {
    super(message, 'PROMOTION_NOT_FOUND');
  }
}

export class PromotionValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PROMOTION_VALIDATION_FAILED');
  }
}
