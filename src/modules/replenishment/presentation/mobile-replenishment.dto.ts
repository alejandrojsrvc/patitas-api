import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsBoolean,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateMobileReplenishmentPlanDto {
  @IsUUID() public petId!: string;
  @IsUUID() public estimateId!: string;
  @IsOptional() @IsUUID() public productId?: string;
  @IsOptional() @IsUUID() public variantId?: string;
  @IsOptional() @IsDateString() public bagStartedAt?: string;
  @IsOptional()
  @IsIn([
    'ALMOST_FULL',
    'MORE_THAN_HALF',
    'ABOUT_HALF',
    'ALMOST_EMPTY',
    'FINISHED',
  ])
  public remainingBucket?: string;
  @IsIn(['PUSH', 'EMAIL', 'WHATSAPP', 'push', 'email', 'whatsapp'], {
    each: true,
  })
  public reminderChannels!: Array<
    'PUSH' | 'EMAIL' | 'WHATSAPP' | 'push' | 'email' | 'whatsapp'
  >;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  public leadDays = 5;
  @IsOptional()
  @IsBoolean()
  public remindersEnabled = true;
}

export class UpdateMobileReplenishmentPlanDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'])
  public status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
  @IsOptional()
  @IsDateString()
  public nextReminderAt?: string;
  @IsOptional()
  @IsBoolean()
  public remindersEnabled?: boolean;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  public leadDays?: number;
}

export class ChangeMobileReplenishmentProductDto {
  @IsUUID() public productId!: string;
  @IsUUID() public variantId!: string;
  @IsOptional() @IsDateString() public bagStartedAt?: string;
  @IsOptional()
  @IsIn(['ALMOST_FULL', 'MORE_THAN_HALF', 'ABOUT_HALF', 'ALMOST_EMPTY'])
  public remainingBucket?: string;
}

export class RecalibrateMobileReplenishmentPlanDto {
  @IsOptional()
  @IsIn(['FEW_DAYS', 'ABOUT_WEEK', 'MORE_THAN_WEEK'])
  public bucket?: 'FEW_DAYS' | 'ABOUT_WEEK' | 'MORE_THAN_WEEK';
  @IsOptional()
  @IsIn([
    'ALMOST_FULL',
    'MORE_THAN_HALF',
    'ABOUT_HALF',
    'ALMOST_EMPTY',
    'FINISHED',
  ])
  public remainingBucket?: string;
  @IsOptional() @IsDateString() public observedAt?: string;
}

export class StartMobileReplenishmentBagDto {
  @IsUUID() public orderId!: string;
  @IsUUID() public orderLineId!: string;
  @IsDateString() public startedAt!: string;
}

export class ReorderMobileCartDto {
  @IsOptional() @IsInt() @Min(1) @Max(99) public quantity = 1;
}
