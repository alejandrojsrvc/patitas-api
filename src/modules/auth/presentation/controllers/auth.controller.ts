import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ProviderAuthenticationError,
  ProviderOperationError,
} from '../../../../shared/application/provider-error';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { ExternalIdentityConflictError } from '../../domain/errors/external-identity-conflict.error';
import { AuthCredentialsDto } from '../dto/auth-credentials.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { RefreshSessionDto } from '../dto/refresh-session.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  public constructor(
    private readonly registerUser: RegisterUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
  ) {}

  @Post('register')
  public async register(@Body() input: AuthCredentialsDto) {
    try {
      return AuthResponseDto.fromResult(await this.registerUser.execute(input));
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
  public async login(@Body() input: AuthCredentialsDto) {
    try {
      return AuthResponseDto.authenticated(await this.loginUser.execute(input));
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        throw new UnauthorizedException('Credenciales inválidas.');
      }
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(200)
  public async refresh(@Body() input: RefreshSessionDto) {
    try {
      return AuthResponseDto.authenticated(
        await this.refreshSession.execute(input.refreshToken),
      );
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        throw new UnauthorizedException('La sesión no puede renovarse.');
      }
      throw error;
    }
  }
}
