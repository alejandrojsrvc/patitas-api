import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
export class CreateReferralCampaignDto {
  @ApiProperty() @IsString() @MaxLength(120) public name!: string;
  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED'] })
  @IsIn(['PERCENTAGE', 'FIXED'])
  public rewardType!: 'PERCENTAGE' | 'FIXED';
  @ApiProperty() @IsNumberString() public rewardValue!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public minimumSubtotal?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public firstOrderOnly?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public expiresAt?: Date | null;
}
export class CreateReferralCodeDto {
  @ApiProperty() @IsString() public campaignId!: string;
}
export class AttributeReferralDto {
  @ApiProperty() @IsString() public code!: string;
}
