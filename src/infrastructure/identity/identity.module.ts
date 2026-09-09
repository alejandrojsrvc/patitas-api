import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { IDENTITY_PROVIDER } from '../../shared/application/ports/identity-provider.interface';
import { JwtIdentityAdapter } from './jwt/jwt-identity.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    JwtIdentityAdapter,
    {
      provide: IDENTITY_PROVIDER,
      useExisting: JwtIdentityAdapter,
    },
  ],
  exports: [IDENTITY_PROVIDER],
})
export class IdentityModule {}
