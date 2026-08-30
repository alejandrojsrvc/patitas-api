import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { IdentityModule } from '../../infrastructure/identity/identity.module';
import { NotificationInfrastructureModule } from '../../infrastructure/notifications/notification.module';
import { ResendNotificationAdapter } from '../../infrastructure/notifications/resend-notification.adapter';
import {
  IDENTITY_PROVIDER,
  type IdentityProvider,
} from '../../shared/application/ports/identity-provider.interface';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { AuthEmailService } from './application/auth-email.service';
import { ConfirmEmailUseCase } from './application/use-cases/confirm-email.use-case';
import { RequestPasswordRecoveryUseCase } from './application/use-cases/request-password-recovery.use-case';
import { ResendEmailConfirmationUseCase } from './application/use-cases/resend-email-confirmation.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
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
import type { NotificationProvider } from '../../shared/application/ports/notification-provider.interface';

@Module({
  imports: [IdentityModule, PrismaModule, NotificationInfrastructureModule],
  controllers: [AuthController, MeController],
  providers: [
    { provide: AUTH_ACCOUNT_REPOSITORY, useClass: PrismaAuthAccountRepository },
    {
      provide: AuthEmailService,
      inject: [ResendNotificationAdapter],
      useFactory: (notifications: NotificationProvider) =>
        new AuthEmailService(notifications),
    },
    {
      provide: RegisterUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY, AuthEmailService],
      useFactory: (
        identity: IdentityProvider,
        accounts: AuthAccountRepository,
        emails: AuthEmailService,
      ) => new RegisterUseCase(identity, accounts, emails),
    },
    {
      provide: ConfirmEmailUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (
        identity: IdentityProvider,
        accounts: AuthAccountRepository,
      ) => new ConfirmEmailUseCase(identity, accounts),
    },
    {
      provide: ResendEmailConfirmationUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY, AuthEmailService],
      useFactory: (
        identity: IdentityProvider,
        accounts: AuthAccountRepository,
        emails: AuthEmailService,
      ) => new ResendEmailConfirmationUseCase(identity, accounts, emails),
    },
    {
      provide: RequestPasswordRecoveryUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY, AuthEmailService],
      useFactory: (
        identity: IdentityProvider,
        accounts: AuthAccountRepository,
        emails: AuthEmailService,
      ) => new RequestPasswordRecoveryUseCase(identity, accounts, emails),
    },
    {
      provide: ResetPasswordUseCase,
      inject: [IDENTITY_PROVIDER],
      useFactory: (identity: IdentityProvider) =>
        new ResetPasswordUseCase(identity),
    },
    {
      provide: LoginUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (
        identity: IdentityProvider,
        accounts: AuthAccountRepository,
      ) => new LoginUseCase(identity, accounts),
    },
    {
      provide: RefreshSessionUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (
        identity: IdentityProvider,
        accounts: AuthAccountRepository,
      ) => new RefreshSessionUseCase(identity, accounts),
    },
    {
      provide: ResolveAccessTokenUseCase,
      inject: [IDENTITY_PROVIDER, AUTH_ACCOUNT_REPOSITORY],
      useFactory: (
        identity: IdentityProvider,
        accounts: AuthAccountRepository,
      ) => new ResolveAccessTokenUseCase(identity, accounts),
    },
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    RegisterUseCase,
    ConfirmEmailUseCase,
    ResendEmailConfirmationUseCase,
    RequestPasswordRecoveryUseCase,
    ResetPasswordUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    ResolveAccessTokenUseCase,
  ],
})
export class AuthModule {}
