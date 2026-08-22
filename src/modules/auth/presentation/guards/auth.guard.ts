import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ResolveAccessTokenUseCase } from '../../application/use-cases/resolve-access-token.use-case';
import { ProviderAuthenticationError } from '../../../../shared/application/provider-error';
import type { AuthenticatedRequest } from '../authenticated-user';

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(private readonly resolveToken: ResolveAccessTokenUseCase) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Se requiere un bearer token válido.');
    }

    try {
      const user = await this.resolveToken.execute(token);
      request.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };
      return true;
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        throw new UnauthorizedException('El bearer token no es válido.');
      }
      throw error;
    }
  }
}
