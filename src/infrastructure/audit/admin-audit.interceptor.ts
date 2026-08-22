import {
  HttpException,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../database/generated/prisma/client';
import type { AuthenticatedRequest } from '../../modules/auth/presentation/authenticated-user';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  public constructor(private readonly prisma: PrismaService) {}

  public intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    const route = request.route as { path?: string } | undefined;
    const action = `${request.method} ${route?.path ?? request.path}`;
    return next.handle().pipe(
      tap({
        next: () => {
          void this.persist(
            request,
            action,
            response.statusCode,
            sanitizeRequest(request),
          );
        },
        error: (error: unknown) => {
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          void this.persist(request, action, statusCode, {
            ...sanitizeRequest(request),
            error: error instanceof Error ? error.name : 'UnknownError',
          });
        },
      }),
    );
  }

  private async persist(
    request: AuthenticatedRequest,
    action: string,
    statusCode: number,
    metadata: Prisma.InputJsonObject,
  ) {
    await this.prisma.adminAuditLog
      .create({
        data: {
          actorUserId: request.user?.userId ?? null,
          action,
          method: request.method,
          path: request.path,
          statusCode,
          metadata,
        },
      })
      .catch(() => undefined);
  }
}

const sanitizeRequest = (
  request: AuthenticatedRequest,
): Prisma.InputJsonObject => {
  const safeParams = Object.fromEntries(
    Object.entries(request.params ?? {}).filter(([key]) => SAFE_KEYS.has(key)),
  );
  const safeQuery = Object.fromEntries(
    Object.entries(request.query ?? {}).filter(([key]) => SAFE_KEYS.has(key)),
  );
  return { params: toJsonObject(safeParams), query: toJsonObject(safeQuery) };
};

const toJsonObject = (
  value: Record<string, unknown>,
): Prisma.InputJsonObject => {
  const entries: Array<[string, Prisma.InputJsonValue]> = [];
  for (const [key, raw] of Object.entries(value)) {
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean'
    ) {
      entries.push([key, raw]);
    } else if (
      Array.isArray(raw) &&
      raw.every((item): item is string => typeof item === 'string')
    ) {
      entries.push([key, raw]);
    }
  }
  return Object.fromEntries(entries);
};

const SAFE_KEYS = new Set([
  'id',
  'orderId',
  'paymentId',
  'variantId',
  'productId',
  'customerId',
  'supplierId',
  'pricingReviewId',
  'status',
  'method',
]);
