import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class AuthCredentialsDto {
  @ApiProperty({ example: 'persona@example.com' })
  @IsEmail()
  @MaxLength(320)
  public email!: string;

  @ApiProperty({ minLength: 8, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public password!: string;
}
