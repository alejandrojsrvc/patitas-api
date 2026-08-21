import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import {
  USER_REPOSITORY,
  type UserRepository,
} from './domain/repositories/user.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: CreateUserUseCase,
      inject: [USER_REPOSITORY],
      useFactory: (repository: UserRepository): CreateUserUseCase =>
        new CreateUserUseCase(repository),
    },
  ],
})
export class UsersModule {}
