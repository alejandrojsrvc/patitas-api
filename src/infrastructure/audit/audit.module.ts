import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AdminAuditInterceptor],
  exports: [AdminAuditInterceptor],
})
export class AuditModule {}
