import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest } from '../../modules/auth/presentation/authenticated-user';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  public constructor(private readonly prisma: PrismaService) {}

  public intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const action = `${request.method} ${request.route?.path ?? request.path}`;
    return next.handle().pipe(
      tap(() => {
        void this.prisma.adminAuditLog.create({
          data: {
            actorUserId: request.user?.userId ?? null,
            action,
            method: request.method,
            path: request.path,
            statusCode: response.statusCode,
          },
        }).catch(() => undefined);
      }),
    );
  }
}
