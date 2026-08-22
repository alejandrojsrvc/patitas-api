import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PricingRuleValuesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public fulfillmentCost?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public packagingCost?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public paymentFixedCost?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public paymentFeePercent?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public subsidizedShippingCost?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public taxPercent?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public otherCost?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public targetMarginPercent?: string;
}

export class CalculatePriceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public variantId!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public supplierOfferId?: string;
  @ApiPropertyOptional({ type: PricingRuleValuesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingRuleValuesDto)
  public overrides?: PricingRuleValuesDto;
}

export class RecalculatePriceDto {
  @ApiPropertyOptional({ type: PricingRuleValuesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingRuleValuesDto)
  public overrides?: PricingRuleValuesDto;
}

export class ApplyPriceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public pricingReviewId!: string;
}

export class PricingReviewsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() public q?: string;
  @ApiPropertyOptional({ enum: ['PENDING', 'APPLIED', 'SUPERSEDED'] })
  @IsOptional()
  @IsIn(['PENDING', 'APPLIED', 'SUPERSEDED'])
  public status?: 'PENDING' | 'APPLIED' | 'SUPERSEDED';
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page = 1;
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public perPage = 25;
}
