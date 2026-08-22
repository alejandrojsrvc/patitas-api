import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../shared/application/ports/storage-provider.interface';
import { AnalyticsService } from './application/analytics.service';
import {
  ANALYTICS_REPOSITORY,
  type AnalyticsRepository,
} from './domain/analytics.repository';
import { PrismaAnalyticsRepository } from './infrastructure/prisma-analytics.repository';
import {
  AdminAnalyticsController,
  PublicAnalyticsController,
} from './presentation/analytics.controller';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [PublicAnalyticsController, AdminAnalyticsController],
  providers: [
    { provide: ANALYTICS_REPOSITORY, useClass: PrismaAnalyticsRepository },
    {
      provide: AnalyticsService,
      inject: [ANALYTICS_REPOSITORY, STORAGE_PROVIDER],
      useFactory: (repository: AnalyticsRepository, storage: StorageProvider) =>
        new AnalyticsService(repository, storage),
    },
  ],
})
export class AnalyticsModule {}
