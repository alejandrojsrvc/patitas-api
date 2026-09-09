import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min, IsNumberString } from 'class-validator';
import { PURCHASE_SCHEDULE_FREQUENCIES } from '../domain/purchase-schedule.types';

export class ConfigurePurchaseScheduleDto {
  @ApiProperty() @IsBoolean() public enabled!: boolean;
  @ApiPropertyOptional({ enum: PURCHASE_SCHEDULE_FREQUENCIES })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(30)
  @IsIn(PURCHASE_SCHEDULE_FREQUENCIES)
  public frequencyDays?: number;
}

export class UpdatePurchaseScheduleStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'PAUSED', 'CANCELLED'] })
  @IsIn(['ACTIVE', 'PAUSED', 'CANCELLED'])
  public status!: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
}

export class PurchaseScheduleIdDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public id!: string;
}

export class UpdatePurchaseScheduleConfigurationDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public enabled?: boolean;
  @ApiPropertyOptional({ example: '10.00' })
  @IsOptional()
  @IsNumberString()
  public discountPercent?: string;
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  public leadDays?: number;
}
