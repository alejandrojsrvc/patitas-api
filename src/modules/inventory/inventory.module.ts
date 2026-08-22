import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryService } from './application/inventory.service';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepository,
} from './domain/inventory.repository';
import { PrismaInventoryRepository } from './infrastructure/prisma-inventory.repository';
import { InventoryController } from './presentation/inventory.controller';
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InventoryController],
  providers: [
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
    {
      provide: InventoryService,
      inject: [INVENTORY_REPOSITORY],
      useFactory: (repository: InventoryRepository) =>
        new InventoryService(repository),
    },
  ],
})
export class InventoryModule {}
