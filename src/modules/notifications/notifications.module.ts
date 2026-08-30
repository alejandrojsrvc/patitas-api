import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { NotificationInfrastructureModule } from '../../infrastructure/notifications/notification.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../../shared/application/ports/notification-provider.interface';
import { NotificationService } from './application/notification.service';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from './domain/notification.repository';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository';
import { NotificationController } from './presentation/notification.controller';
import { NotificationJobsController } from './presentation/notification-jobs.controller';
import { MobileNotificationController } from './presentation/mobile-notification.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NotificationInfrastructureModule,
    AuthModule,
    CustomersModule,
  ],
  controllers: [
    NotificationController,
    NotificationJobsController,
    MobileNotificationController,
  ],
  providers: [
    PrismaNotificationRepository,
    {
      provide: NOTIFICATION_REPOSITORY,
      useExisting: PrismaNotificationRepository,
    },
    {
      provide: NotificationService,
      inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_PROVIDER],
      useFactory: (
        repository: NotificationRepository,
        provider: NotificationProvider,
      ) => new NotificationService(repository, provider),
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
