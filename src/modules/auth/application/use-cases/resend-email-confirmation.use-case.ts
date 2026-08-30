import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';
import { AuthEmailService } from '../auth-email.service';

export class ResendEmailConfirmationUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
    private readonly emails: AuthEmailService,
  ) {}

  public async execute(email: string): Promise<void> {
    if (await this.accounts.findIdentityByEmail(email)) return;
    const action = await this.identityProvider.createEmailConfirmation(email);
    if (action) await this.emails.sendConfirmation(email, action);
  }
}
