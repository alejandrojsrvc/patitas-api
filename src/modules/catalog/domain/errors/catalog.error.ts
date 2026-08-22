import { DomainError } from '../../../../shared/domain/domain-error';

export class CatalogNotFoundError extends DomainError {
  public constructor(resource: string) {
    super(`${resource} no existe.`, 'CATALOG_NOT_FOUND');
  }
}

export class CatalogValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'CATALOG_VALIDATION_FAILED');
  }
}

export class CatalogConflictError extends DomainError {
  public constructor(message: string) {
    super(message, 'CATALOG_CONFLICT');
  }
}
