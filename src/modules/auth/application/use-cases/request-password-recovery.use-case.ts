import type { IdentityProvider } from '../../../../shared/application/ports/identity-provider.interface';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';
import { AuthEmailService } from '../auth-email.service';

export class RequestPasswordRecoveryUseCase {
  public constructor(
    private readonly identityProvider: IdentityProvider,
    private readonly accounts: AuthAccountRepository,
    private readonly emails: AuthEmailService,
  ) {}

  public async execute(email: string): Promise<void> {
    const identity = await this.accounts.findIdentityByEmail(email);
    if (!identity?.email) return;
    const action = await this.identityProvider.createPasswordRecovery(
      identity.email,
    );
    if (action) await this.emails.sendPasswordRecovery(identity.email, action);
  }
}
