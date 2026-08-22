import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';
import type { RegistrationResult } from '../auth-result';

export interface RegisterInput {
  email: string;
  password: string;
}

export class RegisterUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
  ) {}

  public async execute(input: RegisterInput): Promise<RegistrationResult> {
    const registration = await this.identityProvider.register(input);
    if (!registration.session) {
      return { status: 'verification_required', user: null };
    }
    const user = await this.accounts.provision(registration.identity);
    return { status: 'authenticated', user, session: registration.session };
  }
}
