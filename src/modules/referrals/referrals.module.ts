import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { ReferralService } from './application/referral.service';
import { AdminReferralController, ReferralController } from './presentation/referral.controller';

@Module({ imports: [PrismaModule, AuthModule, CustomersModule], controllers: [ReferralController, AdminReferralController], providers: [{ provide: ReferralService, inject: [PrismaService], useFactory: (prisma: PrismaService) => new ReferralService(prisma) }], exports: [ReferralService] })
export class ReferralsModule {}
