import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';
import type { AuthenticatedResult } from '../auth-result';

export class RefreshSessionUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
  ) {}

  public async execute(refreshToken: string): Promise<AuthenticatedResult> {
    const session = await this.identityProvider.refresh(refreshToken);
    const user = await this.accounts.provision(session.identity);
    return { status: 'authenticated', user, session };
  }
}
