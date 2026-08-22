import { ApiProperty } from '@nestjs/swagger';
import type {
  AuthenticatedResult,
  RegistrationResult,
} from '../../application/auth-result';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;
  @ApiProperty()
  public email!: string;
  @ApiProperty({ enum: ['CUSTOMER', 'ADMIN'] })
  public role!: string;
}

export class AuthSessionDto {
  @ApiProperty()
  public accessToken!: string;
  @ApiProperty()
  public refreshToken!: string;
  @ApiProperty({ nullable: true })
  public expiresAt!: number | null;
}

export class AuthResponseDto {
  @ApiProperty({ enum: ['authenticated', 'verification_required'] })
  public status!: 'authenticated' | 'verification_required';
  @ApiProperty({ type: AuthUserDto, nullable: true })
  public user!: AuthUserDto | null;
  @ApiProperty({ type: AuthSessionDto, nullable: true })
  public session!: AuthSessionDto | null;

  public static fromResult(result: RegistrationResult): AuthResponseDto {
    return {
      status: result.status,
      user: result.user
        ? {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
          }
        : null,
      session:
        result.status === 'authenticated'
          ? {
              accessToken: result.session.accessToken,
              refreshToken: result.session.refreshToken,
              expiresAt: result.session.expiresAt,
            }
          : null,
    };
  }

  public static authenticated(result: AuthenticatedResult): AuthResponseDto {
    return this.fromResult(result);
  }
}
