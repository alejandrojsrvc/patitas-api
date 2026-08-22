import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumberString, IsObject, IsOptional, IsUUID, ValidateNested } from 'class-validator';

export class PricingRuleValuesDto {
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public fulfillmentCost?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public packagingCost?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public paymentFixedCost?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public paymentFeePercent?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public subsidizedShippingCost?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public taxPercent?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public otherCost?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public targetMarginPercent?: string;
}

export class CalculatePriceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public variantId!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() public supplierOfferId?: string;
  @ApiPropertyOptional({ type: PricingRuleValuesDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PricingRuleValuesDto)
  public overrides?: PricingRuleValuesDto;
}

export class RecalculatePriceDto {
  @ApiPropertyOptional({ type: PricingRuleValuesDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PricingRuleValuesDto)
  public overrides?: PricingRuleValuesDto;
}

export class ApplyPriceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public pricingReviewId!: string;
}

export class PricingReviewsQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPLIED', 'SUPERSEDED'] })
  @IsOptional()
  @IsIn(['PENDING', 'APPLIED', 'SUPERSEDED'])
  public status?: 'PENDING' | 'APPLIED' | 'SUPERSEDED';
}
