import { DomainError } from '../../../../shared/domain/domain-error';

export class PricingPreconditionError extends DomainError {
  public constructor(message: string) {
    super(message, 'PRICING_PRECONDITION_FAILED');
  }
}

export class StalePricingReviewError extends DomainError {
  public constructor(message: string) {
    super(message, 'PRICING_REVIEW_STALE');
  }
}

export class PricingNotFoundError extends DomainError {
  public constructor(message: string) {
    super(message, 'PRICING_REVIEW_NOT_FOUND');
  }
}
