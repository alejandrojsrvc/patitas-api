import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsEmail()
  @MaxLength(320)
  public email!: string;
}
