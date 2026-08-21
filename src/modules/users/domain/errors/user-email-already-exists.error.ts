import { DomainError } from '../../../../shared/domain/domain-error';

export class UserEmailAlreadyExistsError extends DomainError {
  public constructor(email: string) {
    super(
      `Ya existe un usuario con el email ${email}.`,
      'USER_EMAIL_ALREADY_EXISTS',
    );
  }
}
