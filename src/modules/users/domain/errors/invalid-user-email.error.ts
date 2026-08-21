import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidUserEmailError extends DomainError {
  public constructor() {
    super('El email del usuario no es válido.', 'USER_EMAIL_INVALID');
  }
}
