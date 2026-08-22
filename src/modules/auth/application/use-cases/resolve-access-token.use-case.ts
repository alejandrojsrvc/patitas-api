import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';
import type { User } from '../../../users/domain/entities/user.entity';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';

export class ResolveAccessTokenUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
  ) {}

  public async execute(accessToken: string): Promise<User> {
    const identity = await this.identityProvider.verifyToken(accessToken);
    return this.accounts.provision(identity);
  }
}
