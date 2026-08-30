import type { NotificationProvider } from '../../../shared/application/ports/notification-provider.interface';
import type { IdentityEmailAction } from '../../../shared/application/ports/identity-provider.interface';

export class AuthEmailService {
  public constructor(private readonly notifications: NotificationProvider) {}

  public async sendConfirmation(
    email: string,
    action: IdentityEmailAction,
  ): Promise<void> {
    await this.notifications.send({
      channel: 'EMAIL',
      destination: email.trim().toLowerCase(),
      template: 'account_confirmation',
      variables: { token: action.token, type: action.type },
    });
  }

  public async sendPasswordRecovery(
    email: string,
    action: IdentityEmailAction,
  ): Promise<void> {
    await this.notifications.send({
      channel: 'EMAIL',
      destination: email.trim().toLowerCase(),
      template: 'password_recovery',
      variables: { token: action.token },
    });
  }
}
