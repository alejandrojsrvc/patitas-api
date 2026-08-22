import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationInfrastructureModule } from '../../infrastructure/notifications/notification.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from '../../shared/application/ports/notification-provider.interface';
import { NotificationService } from './application/notification.service';
import { NotificationController } from './presentation/notification.controller';
import { NotificationJobsController } from './presentation/notification-jobs.controller';

@Module({ imports: [ConfigModule, PrismaModule, NotificationInfrastructureModule, AuthModule, CustomersModule], controllers: [NotificationController, NotificationJobsController], providers: [{ provide: NotificationService, inject: [PrismaService, NOTIFICATION_PROVIDER], useFactory: (prisma: PrismaService, provider: NotificationProvider) => new NotificationService(prisma, provider) }], exports: [NotificationService] })
export class NotificationsModule {}
