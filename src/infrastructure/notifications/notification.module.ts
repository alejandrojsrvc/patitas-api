import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from '../../shared/application/ports/notification-provider.interface';
import { HttpNotificationAdapter } from './http-notification.adapter';
import { NoopNotificationAdapter } from './noop-notification.adapter';

@Module({
  imports: [ConfigModule],
  providers: [HttpNotificationAdapter, NoopNotificationAdapter, { provide: NOTIFICATION_PROVIDER, inject: [ConfigService, HttpNotificationAdapter, NoopNotificationAdapter], useFactory: (config: ConfigService, http: HttpNotificationAdapter, noop: NoopNotificationAdapter): NotificationProvider => config.get<string>('NOTIFICATION_PROVIDER', 'noop') === 'http' ? http : noop }],
  exports: [NOTIFICATION_PROVIDER],
})
export class NotificationInfrastructureModule {}
