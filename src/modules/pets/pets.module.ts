import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { PetService } from './application/pet.service';
import { PET_REPOSITORY, type PetRepository } from './domain/pet.repository';
import { PrismaPetRepository } from './infrastructure/prisma-pet.repository';
import { PetController } from './presentation/pet.controller';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [PetController],
  providers: [
    { provide: PET_REPOSITORY, useClass: PrismaPetRepository },
    {
      provide: PetService,
      inject: [PET_REPOSITORY],
      useFactory: (repository: PetRepository) => new PetService(repository),
    },
  ],
  exports: [PetService],
})
export class PetsModule {}
