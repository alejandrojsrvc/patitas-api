import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { PetService } from './application/pet.service';
import { PetBreedService } from './application/pet-breed.service';
import {
  PET_BREED_REPOSITORY,
  type PetBreedRepository,
} from './domain/pet-breed.repository';
import { PET_REPOSITORY, type PetRepository } from './domain/pet.repository';
import { PrismaPetRepository } from './infrastructure/prisma-pet.repository';
import { PrismaPetBreedRepository } from './infrastructure/prisma-pet-breed.repository';
import { PetController } from './presentation/pet.controller';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [PetController],
  providers: [
    { provide: PET_REPOSITORY, useClass: PrismaPetRepository },
    { provide: PET_BREED_REPOSITORY, useClass: PrismaPetBreedRepository },
    {
      provide: PetService,
      inject: [PET_REPOSITORY, PET_BREED_REPOSITORY],
      useFactory: (repository: PetRepository, breeds: PetBreedRepository) =>
        new PetService(repository, breeds),
    },
    {
      provide: PetBreedService,
      inject: [PET_BREED_REPOSITORY],
      useFactory: (repository: PetBreedRepository) =>
        new PetBreedService(repository),
    },
  ],
  exports: [PetService, PetBreedService],
})
export class PetsModule {}
