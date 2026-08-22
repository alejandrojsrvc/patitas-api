import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AuditController } from './audit.controller';

@Global()
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AuditController],
  providers: [AdminAuditInterceptor],
  exports: [AdminAuditInterceptor],
})
export class AuditModule {}
