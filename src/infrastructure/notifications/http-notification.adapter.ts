import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NotificationInput,
  NotificationProvider,
  NotificationResult,
} from '../../shared/application/ports/notification-provider.interface';

@Injectable()
export class HttpNotificationAdapter implements NotificationProvider {
  private readonly url: string | undefined;
  private readonly token: string | undefined;
  public constructor(config: ConfigService) {
    this.url =
      config.get<string>('NOTIFICATION_PROVIDER_URL')?.trim() || undefined;
    this.token =
      config.get<string>('NOTIFICATION_PROVIDER_TOKEN')?.trim() || undefined;
  }
  public async send(input: NotificationInput): Promise<NotificationResult> {
    if (!this.url)
      throw new Error('NOTIFICATION_PROVIDER_URL no está configurado.');
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!response.ok)
      throw new Error('El proveedor de notificaciones rechazó el mensaje.');
    const body = (await response.json().catch(() => ({}))) as {
      messageId?: string;
    };
    return { providerMessageId: body.messageId };
  }
}
