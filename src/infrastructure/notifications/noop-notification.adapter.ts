import { Injectable } from '@nestjs/common';
import type {
  NotificationInput,
  NotificationProvider,
  NotificationResult,
} from '../../shared/application/ports/notification-provider.interface';

@Injectable()
export class NoopNotificationAdapter implements NotificationProvider {
  public send(input: NotificationInput): Promise<NotificationResult> {
    void input;
    return Promise.resolve({});
  }
}
