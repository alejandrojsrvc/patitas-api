import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';
import type { RegistrationResult } from '../auth-result';
import { AuthEmailService } from '../auth-email.service';

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
}

export class RegisterUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
    private readonly emails: AuthEmailService,
  ) {}

  public async execute(input: RegisterInput): Promise<RegistrationResult> {
    const registration = await this.identityProvider.register({
      email: input.email,
      password: input.password,
      ...(input.fullName ? { displayName: input.fullName.trim() } : {}),
    });
    if (!registration.session) {
      if (!registration.emailConfirmation) {
        throw new Error('El proveedor no devolvió una confirmación de email.');
      }
      await this.emails.sendConfirmation(
        input.email,
        registration.emailConfirmation,
      );
      return { status: 'verification_required', user: null };
    }
    const user = await this.accounts.provision(registration.identity);
    return { status: 'authenticated', user, session: registration.session };
  }
}
