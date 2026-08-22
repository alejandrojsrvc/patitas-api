import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { IdentityModule } from '../../infrastructure/identity/identity.module';
import {
  IDENTITY_PROVIDER,
  type IdentityProvider,
} from '../../shared/application/ports/identity-provider.interface';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { ResolveAccessTokenUseCase } from './application/use-cases/resolve-access-token.use-case';
import {
  AUTH_ACCOUNT_REPOSITORY,
  type AuthAccountRepository,
} from './domain/repositories/auth-account.repository';
import { PrismaAuthAccountRepository } from './infrastructure/persistence/prisma-auth-account.repository';
import { AuthController } from './presentation/controllers/auth.controller';
import { MeController } from './presentation/controllers/me.controller';
import { AuthGuard } from './presentation/guards/auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';
import { OptionalAuthGuard } from './presentation/guards/optional-auth.guard';

@Module({
  imports: [IdentityModule, PrismaModule],
  controllers: [AuthController, MeController],
  providers: [
    { provide: AUTH_ACCOUNT_REPOSITORY, useClass: PrismaAuthAccountRepository },
    {
      provide: RegisterUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (identity: IdentityProvider, accounts: AuthAccountRepository) =>
        new RegisterUseCase(identity, accounts),
    },
    {
      provide: LoginUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (identity: IdentityProvider, accounts: AuthAccountRepository) =>
        new LoginUseCase(identity, accounts),
    },
    {
      provide: RefreshSessionUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (identity: IdentityProvider, accounts: AuthAccountRepository) =>
        new RefreshSessionUseCase(identity, accounts),
    },
    {
      provide: ResolveAccessTokenUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (identity: IdentityProvider, accounts: AuthAccountRepository) =>
        new ResolveAccessTokenUseCase(identity, accounts),
    },
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  exports: [AuthGuard, OptionalAuthGuard, RolesGuard, ResolveAccessTokenUseCase],
})
export class AuthModule {}
