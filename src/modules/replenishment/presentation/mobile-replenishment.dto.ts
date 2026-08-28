import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateMobileReplenishmentPlanDto {
  @IsUUID() public petId!: string;
  @IsUUID() public estimateId!: string;
  @IsIn(['PUSH', 'EMAIL', 'WHATSAPP'], { each: true })
  public reminderChannels!: Array<'PUSH' | 'EMAIL' | 'WHATSAPP'>;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  public leadDays = 5;
}

export class UpdateMobileReplenishmentPlanDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'])
  public status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
  @IsOptional()
  @IsDateString()
  public nextReminderAt?: string;
}

export class RecalibrateMobileReplenishmentPlanDto {
  @IsIn(['FEW_DAYS', 'ABOUT_WEEK', 'MORE_THAN_WEEK'])
  public bucket!: 'FEW_DAYS' | 'ABOUT_WEEK' | 'MORE_THAN_WEEK';
}
