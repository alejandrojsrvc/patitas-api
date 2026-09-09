import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from '../../shared/application/ports/notification-provider.interface';
import { HttpNotificationAdapter } from './http-notification.adapter';
import { NoopNotificationAdapter } from './noop-notification.adapter';
import { ResendNotificationAdapter } from './resend-notification.adapter';
import { SmtpNotificationAdapter } from './smtp-notification.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    HttpNotificationAdapter,
    NoopNotificationAdapter,
    ResendNotificationAdapter,
    SmtpNotificationAdapter,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [ConfigService, HttpNotificationAdapter, NoopNotificationAdapter, ResendNotificationAdapter, SmtpNotificationAdapter],
      useFactory: (
        config: ConfigService,
        http: HttpNotificationAdapter,
        noop: NoopNotificationAdapter,
        resend: ResendNotificationAdapter,
        smtp: SmtpNotificationAdapter,
      ): NotificationProvider => selectNotificationProvider(config.get<string>('NOTIFICATION_PROVIDER', 'noop'), http, noop, resend, smtp),
    },
  ],
  exports: [NOTIFICATION_PROVIDER, ResendNotificationAdapter],
})
export class NotificationInfrastructureModule {}

const selectNotificationProvider = (
  name: string,
  http: NotificationProvider,
  noop: NotificationProvider,
  resend: NotificationProvider,
  smtp: NotificationProvider,
): NotificationProvider => {
  switch (name.trim().toLowerCase()) {
    case 'http':
      return http;
    case 'resend':
      return resend;
    case 'smtp':
      return smtp;
    case 'noop':
    case '':
      return noop;
    default:
      throw new Error(`Proveedor de notificaciones no soportado: ${name}.`);
  }
};
