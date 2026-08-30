import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ProviderAuthenticationError,
  ProviderOperationError,
} from '../../../shared/application/provider-error';
import { LoginUseCase } from '../../auth/application/use-cases/login.use-case';
import { RefreshSessionUseCase } from '../../auth/application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '../../auth/application/use-cases/register.use-case';
import { ExternalIdentityConflictError } from '../../auth/domain/errors/external-identity-conflict.error';
import { CustomerService } from '../../customers/application/customer.service';
import { MobileAccessService } from '../application/mobile-access.service';
import {
  MobileLoginDto,
  MobileRefreshDto,
  MobileRegisterDto,
} from './mobile.dto';
import { toMobileSession, toMobileUser } from './mobile.mapper';
import type { CustomerProfile } from '../../customers/domain/customer.types';

@ApiTags('Mobile auth')
@Controller('mobile/auth')
export class MobileAuthController {
  public constructor(
    private readonly registerUser: RegisterUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly customers: CustomerService,
    private readonly accesses: MobileAccessService,
  ) {}

  @Post('register')
  public async register(
    @Body() input: MobileRegisterDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-platform') platform?: string,
    @Headers('x-app-version') appVersion?: string,
  ) {
    try {
      const result = await this.registerUser.execute(input);
      if (result.status === 'verification_required') {
        return { user: null, session: null, verificationRequired: true };
      }
      await this.customers.updateByUserId(result.user.id, {
        fullName: input.fullName,
      });
      this.recordAccess(result.user, deviceId, platform, appVersion);
      return this.authResponse(result.user, result.session, false);
    } catch (error) {
      if (error instanceof ExternalIdentityConflictError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof ProviderOperationError) {
        throw new BadRequestException('No fue posible completar el registro.');
      }
      throw error;
    }
  }

  @Post('login')
  @HttpCode(200)
  public async login(
    @Body() input: MobileLoginDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-platform') platform?: string,
    @Headers('x-app-version') appVersion?: string,
  ) {
    try {
      const result = await this.loginUser.execute(input);
      const customer = await this.customers.findProfileByUserId(result.user.id);
      this.recordAccess(result.user, deviceId, platform, appVersion);
      return this.authResponse(result.user, result.session, false, customer);
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        throw new UnauthorizedException('Credenciales inválidas.');
      }
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(200)
  public async refresh(
    @Body() input: MobileRefreshDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-platform') platform?: string,
    @Headers('x-app-version') appVersion?: string,
  ) {
    try {
      const result = await this.refreshSession.execute(input.refreshToken);
      const customer = await this.customers.findProfileByUserId(result.user.id);
      this.recordAccess(result.user, deviceId, platform, appVersion);
      return this.authResponse(result.user, result.session, false, customer);
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        throw new UnauthorizedException('La sesión no puede renovarse.');
      }
      throw error;
    }
  }

  private recordAccess(
    user: Parameters<typeof toMobileUser>[0],
    deviceId?: string,
    platform?: string,
    appVersion?: string,
  ): void {
    void this.accesses
      .record({
        userId: user.id,
        role: user.role,
        deviceId: deviceId?.trim() || `user:${user.id}`,
        platform,
        appVersion,
      })
      .catch(() => undefined);
  }

  private async authResponse(
    user: Parameters<typeof toMobileUser>[0],
    session: Parameters<typeof toMobileSession>[0],
    verificationRequired: boolean,
    customer?: CustomerProfile,
  ) {
    const resolvedCustomer =
      customer ?? (await this.customers.findProfileByUserId(user.id));
    return {
      user: toMobileUser(user, resolvedCustomer),
      session: toMobileSession(session),
      verificationRequired,
    };
  }
}
