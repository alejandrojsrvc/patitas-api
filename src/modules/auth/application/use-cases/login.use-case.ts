import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';
import type { AuthenticatedResult } from '../auth-result';

export interface LoginInput {
  email: string;
  password: string;
}

export class LoginUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
  ) {}

  public async execute(input: LoginInput): Promise<AuthenticatedResult> {
    const session = await this.identityProvider.login(input);
    const user =
      (await this.accounts.resolve(session.identity)) ??
      (await this.accounts.provision(session.identity));
    return { status: 'authenticated', user, session };
  }
}
