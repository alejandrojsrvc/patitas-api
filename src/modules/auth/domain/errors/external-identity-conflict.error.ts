import { DomainError } from '../../../../shared/domain/domain-error';

export class ExternalIdentityConflictError extends DomainError {
  public constructor() {
    super(
      'La identidad externa no puede vincularse con esta cuenta.',
      'AUTH_EXTERNAL_IDENTITY_CONFLICT',
    );
  }
}
