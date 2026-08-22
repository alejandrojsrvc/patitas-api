import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../../users/domain/entities/user.entity';
import type { AuthenticatedRequest } from '../authenticated-user';
import { ROLES_METADATA } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user || !allowed.includes(request.user.role)) {
      throw new ForbiddenException('No tienes permisos para esta operación.');
    }
    return true;
  }
}
