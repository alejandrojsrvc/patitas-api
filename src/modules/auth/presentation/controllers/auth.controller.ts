import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ProviderAuthenticationError,
  ProviderOperationError,
} from '../../../../shared/application/provider-error';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { ConfirmEmailUseCase } from '../../application/use-cases/confirm-email.use-case';
import { RequestPasswordRecoveryUseCase } from '../../application/use-cases/request-password-recovery.use-case';
import { ResendEmailConfirmationUseCase } from '../../application/use-cases/resend-email-confirmation.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { ExternalIdentityConflictError } from '../../domain/errors/external-identity-conflict.error';
import { AuthCredentialsDto } from '../dto/auth-credentials.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { RefreshSessionDto } from '../dto/refresh-session.dto';
import {
  AuthEmailDto,
  ConfirmEmailDto,
  ResetPasswordDto,
} from '../dto/auth-email-action.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  public constructor(
    private readonly registerUser: RegisterUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly confirmUserEmail: ConfirmEmailUseCase,
    private readonly resendEmailConfirmation: ResendEmailConfirmationUseCase,
    private readonly requestPasswordRecovery: RequestPasswordRecoveryUseCase,
    private readonly resetUserPassword: ResetPasswordUseCase,
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

  @Post('email-confirmation/confirm')
  @HttpCode(200)
  public async confirmEmail(@Body() input: ConfirmEmailDto) {
    try {
      return AuthResponseDto.authenticated(
        await this.confirmUserEmail.execute(input.token, input.type),
      );
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        throw new UnauthorizedException(
          'El enlace de confirmación no es válido o venció.',
        );
      }
      throw error;
    }
  }

  @Post('email-confirmation/resend')
  @HttpCode(202)
  public async resendConfirmation(@Body() input: AuthEmailDto) {
    try {
      await this.resendEmailConfirmation.execute(input.email);
    } catch (error) {
      this.logger.error(
        'No fue posible procesar un reenvío de confirmación.',
        error instanceof Error ? error.stack : undefined,
      );
    }
    return {
      message: 'Si la cuenta requiere confirmación, enviaremos un correo.',
    };
  }

  @Post('password-recovery')
  @HttpCode(202)
  public async recoverPassword(@Body() input: AuthEmailDto) {
    try {
      await this.requestPasswordRecovery.execute(input.email);
    } catch (error) {
      this.logger.error(
        'No fue posible procesar una recuperación de contraseña.',
        error instanceof Error ? error.stack : undefined,
      );
    }
    return {
      message: 'Si la cuenta existe, enviaremos un correo de recuperación.',
    };
  }

  @Post('password-reset')
  @HttpCode(204)
  public async resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    try {
      await this.resetUserPassword.execute(input.token, input.newPassword);
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        throw new UnauthorizedException(
          'El enlace de recuperación no es válido o venció.',
        );
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
