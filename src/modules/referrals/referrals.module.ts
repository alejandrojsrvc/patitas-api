import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { ReferralService } from './application/referral.service';
import {
  REFERRAL_REPOSITORY,
  type ReferralRepository,
} from './domain/referral.repository';
import { PrismaReferralRepository } from './infrastructure/prisma-referral.repository';
import {
  AdminReferralController,
  ReferralController,
} from './presentation/referral.controller';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [ReferralController, AdminReferralController],
  providers: [
    PrismaReferralRepository,
    { provide: REFERRAL_REPOSITORY, useExisting: PrismaReferralRepository },
    {
      provide: ReferralService,
      inject: [REFERRAL_REPOSITORY],
      useFactory: (repository: ReferralRepository) =>
        new ReferralService(repository),
    },
  ],
  exports: [ReferralService],
})
export class ReferralsModule {}
