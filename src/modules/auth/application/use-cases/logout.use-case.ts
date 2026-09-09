import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';

export class LogoutUseCase {
  public constructor(private readonly identityProvider: IdentityProvider) {}

  public execute(accessToken: string, allSessions = false): Promise<void> {
    return allSessions ? this.identityProvider.logoutAll(accessToken) : this.identityProvider.logout(accessToken);
  }
}
