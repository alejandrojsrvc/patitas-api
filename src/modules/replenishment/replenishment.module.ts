import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { ReplenishmentService } from './application/replenishment.service';
import { REPLENISHMENT_REPOSITORY, type ReplenishmentRepository } from './domain/replenishment.repository';
import { PrismaReplenishmentRepository } from './infrastructure/prisma-replenishment.repository';
import { ReplenishmentController } from './presentation/replenishment.controller';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [ReplenishmentController],
  providers: [{ provide: REPLENISHMENT_REPOSITORY, useClass: PrismaReplenishmentRepository }, { provide: ReplenishmentService, inject: [REPLENISHMENT_REPOSITORY], useFactory: (repository: ReplenishmentRepository) => new ReplenishmentService(repository) }],
  exports: [ReplenishmentService],
})
export class ReplenishmentModule {}
