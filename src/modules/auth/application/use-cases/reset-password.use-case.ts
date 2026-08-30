import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';

export class ResetPasswordUseCase {
  public constructor(private readonly identityProvider: IdentityProvider) {}

  public execute(token: string, password: string): Promise<void> {
    return this.identityProvider.resetPassword(token, password);
  }
}
