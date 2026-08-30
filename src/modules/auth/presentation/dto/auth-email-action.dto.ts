import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { EmailConfirmationType } from '../../../../shared/application/ports/identity-provider.interface';

export class AuthEmailDto {
  @ApiProperty({ example: 'persona@example.com' })
  @IsEmail()
  @MaxLength(320)
  public email!: string;
}

export class ConfirmEmailDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  public token!: string;

  @ApiProperty({ enum: ['signup', 'magiclink'] })
  @IsIn(['signup', 'magiclink'])
  public type!: EmailConfirmationType;
}

export class ResetPasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  public token!: string;

  @ApiProperty({ minLength: 8, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public newPassword!: string;
}
