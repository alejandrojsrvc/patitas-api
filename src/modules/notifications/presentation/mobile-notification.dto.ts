import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMobileNotificationPreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() push?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() email?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() whatsapp?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() orderUpdates?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  replenishmentReminders?: boolean;
}

export class RegisterMobileDeviceTokenDto {
  @ApiProperty() @IsString() @MaxLength(500) token!: string;
  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform!: string;
  @ApiPropertyOptional({ default: 'EXPO' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider = 'EXPO';
  @ApiProperty({ description: 'Identificador estable del dispositivo.' })
  @IsString()
  @MaxLength(255)
  deviceId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

export class MobileNotificationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly = false;
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;
}
