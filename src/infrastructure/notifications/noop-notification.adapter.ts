import { Injectable } from '@nestjs/common';
import type { NotificationInput, NotificationProvider, NotificationResult } from '../../shared/application/ports/notification-provider.interface';

@Injectable()
export class NoopNotificationAdapter implements NotificationProvider {
  public async send(_input: NotificationInput): Promise<NotificationResult> { return {}; }
}
