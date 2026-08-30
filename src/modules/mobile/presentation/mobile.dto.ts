import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumberString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export class MobileRegisterDto {
  @ApiProperty() @IsString() @MaxLength(160) public fullName!: string;
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

export class MobileLoginDto {
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

export class MobileRefreshDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(1)
  public refreshToken!: string;
}

export class MobileCustomerUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  public fullName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public phone?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  public avatarUrl?: string | null;
}

export class MobileAddressCreateDto {
  @ApiProperty() @IsString() @MaxLength(80) public label!: string;
  @ApiProperty() @IsString() @MaxLength(160) public recipientName!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public phone?: string | null;
  @ApiProperty() @IsString() @MaxLength(120) public street!: string;
  @ApiProperty() @IsString() @MaxLength(30) public number!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public apartment?: string | null;
  @ApiProperty() @IsString() @MaxLength(100) public city!: string;
  @ApiProperty() @IsString() @MaxLength(100) public province!: string;
  @ApiProperty() @IsString() @MaxLength(20) public postalCode!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  public reference?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public isDefault?: boolean;
}

export class MobileAddressUpdateDto extends PartialType(
  MobileAddressCreateDto,
) {}

export class MobilePetCreateDto {
  @ApiProperty() @IsString() @MaxLength(80) public name!: string;
  @ApiProperty({ enum: ['dog', 'cat'] })
  @IsIn(['dog', 'cat'])
  public species!: 'dog' | 'cat';
  @ApiProperty({ type: Number })
  @Transform(({ value }) => String(value))
  @IsNumberString()
  public weightKg!: string;
  @ApiProperty({ enum: ['puppy', 'adult', 'senior'] })
  @IsIn(['puppy', 'adult', 'senior'])
  public lifeStage!: 'puppy' | 'adult' | 'senior';
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public breed?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public breedId?: string | null;
  @ApiPropertyOptional({ enum: ['male', 'female', 'unknown'], nullable: true })
  @IsOptional()
  @IsIn(['male', 'female', 'unknown', 'MALE', 'FEMALE', 'UNKNOWN'])
  public sex?:
    'male' | 'female' | 'unknown' | 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  public birthDate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => MobilePetAgeDto)
  public age?: MobilePetAgeDto | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  public avatarUrl?: string | null;
}

export class MobilePetAgeDto {
  @IsInt() @Min(0) @Max(50) public value!: number;
  @IsIn(['months', 'years']) public unit!: 'months' | 'years';
}

export class MobilePetUpdateDto extends PartialType(MobilePetCreateDto) {}

export class MobilePetBreedsQueryDto {
  @ApiPropertyOptional({ enum: ['dog', 'cat'] })
  @IsOptional()
  @IsIn(['dog', 'cat'])
  public species?: 'dog' | 'cat';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public query?: string;
}
