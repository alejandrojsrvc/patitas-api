import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../auth/presentation/authenticated-user';
import { MobileAccessService } from '../application/mobile-access.service';

@Injectable()
export class MobileAccessInterceptor implements NestInterceptor {
  public constructor(private readonly accesses: MobileAccessService) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!isMobilePath(request.path)) return next.handle();
    const deviceId =
      header(request.headers['x-device-id']) ??
      header(request.headers['x-mobile-device-id']) ??
      (request.user ? `user:${request.user.userId}` : undefined);
    if (deviceId && request.user) {
      void this.accesses
        .record({
          userId: request.user.userId,
          role: request.user.role,
          deviceId,
          platform: header(request.headers['x-platform']),
          appVersion: header(request.headers['x-app-version']),
        })
        .catch(() => undefined);
    }
    return next.handle();
  }
}

const header = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const isMobilePath = (path: string): boolean =>
  path === '/mobile' ||
  path.startsWith('/mobile/') ||
  path === '/api/v1/mobile' ||
  path.startsWith('/api/v1/mobile/');
