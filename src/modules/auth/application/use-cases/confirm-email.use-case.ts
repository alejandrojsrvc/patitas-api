import type {
  EmailConfirmationType,
  IdentityProvider,
} from '../../../../shared/application/ports/identity-provider.interface';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';
import type { AuthenticatedResult } from '../auth-result';

export class ConfirmEmailUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
  ) {}

  public async execute(
    token: string,
    type: EmailConfirmationType,
  ): Promise<AuthenticatedResult> {
    const session = await this.identityProvider.confirmEmail(token, type);
    const user = await this.accounts.provision(session.identity);
    return { status: 'authenticated', user, session };
  }
}
