import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsBoolean,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsDateString,
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
  @IsBoolean()
  public paymentFeeVatApplies?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public paymentFeeVatPercent?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public paymentFeeScheduleId?: string;
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
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public scenarioId?: string;
  @ApiPropertyOptional({ type: PricingRuleValuesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingRuleValuesDto)
  public overrides?: PricingRuleValuesDto;
}

export class RecalculatePriceDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public supplierOfferId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public scenarioId?: string;
  @ApiPropertyOptional({ type: PricingRuleValuesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingRuleValuesDto)
  public overrides?: PricingRuleValuesDto;
}

export class BulkRecalculatePriceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public scenarioId!: string;
}

export class ApplyPriceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public pricingReviewId!: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  public activateProduct = false;
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

export class CreatePaymentFeeScheduleDto {
  @ApiProperty({ enum: ['MERCADOPAGO', 'PAYWAY'] })
  @IsIn(['MERCADOPAGO', 'PAYWAY'])
  public provider!: 'MERCADOPAGO' | 'PAYWAY';
  @ApiProperty({ enum: ['CHECKOUT_PRO'] })
  @IsIn(['CHECKOUT_PRO'])
  public product!: 'CHECKOUT_PRO';
  @ApiProperty() @IsString() public name!: string;
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  public settlementDays!: number;
  @ApiProperty() @IsNumberString() public feePercent!: string;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  public vatApplies = true;
  @ApiProperty() @IsNumberString() public vatPercent!: string;
  @ApiPropertyOptional({ default: '0.00' })
  @IsOptional()
  @IsNumberString()
  public fixedFee = '0.00';
  @ApiPropertyOptional({ default: 'ARS' })
  @IsOptional()
  @IsIn(['ARS'])
  public currency = 'ARS' as const;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  public active = true;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  public effectiveFrom?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  public effectiveTo?: string;
}

export class UpdatePaymentFeeScheduleDto extends PartialType(
  CreatePaymentFeeScheduleDto,
) {}

export class CreateOperatingCostDto {
  @ApiProperty() @IsString() public name!: string;
  @ApiProperty({
    enum: ['FIXED_MONTHLY', 'PER_ORDER', 'PER_UNIT', 'PERCENT_OF_SALE'],
  })
  @IsIn(['FIXED_MONTHLY', 'PER_ORDER', 'PER_UNIT', 'PERCENT_OF_SALE'])
  public type!: 'FIXED_MONTHLY' | 'PER_ORDER' | 'PER_UNIT' | 'PERCENT_OF_SALE';
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public amount?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public percent?: string;
  @ApiPropertyOptional({ default: 'ARS' })
  @IsOptional()
  @IsIn(['ARS'])
  public currency = 'ARS' as const;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  public active = true;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  public effectiveFrom?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  public effectiveTo?: string;
}

export class UpdateOperatingCostDto extends PartialType(
  CreateOperatingCostDto,
) {}

export class CreatePricingScenarioDto {
  @ApiProperty() @IsString() public name!: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  public periodStart!: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  public periodEnd!: string;
  @ApiPropertyOptional({ enum: ['MANUAL', 'PREVIOUS_PERIOD'] })
  @IsOptional()
  @IsIn(['MANUAL', 'PREVIOUS_PERIOD'])
  public ordersSource: 'MANUAL' | 'PREVIOUS_PERIOD' = 'MANUAL';
  @ApiPropertyOptional({ default: 20, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public projectedOrders = 20;
  @ApiPropertyOptional({ default: '1.00', minimum: 0 })
  @IsOptional()
  @IsNumberString()
  public averageItemsPerOrder = '1.00';
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public paymentFeeScheduleId?: string;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  public active = true;
}

export class UpdatePricingScenarioDto extends PartialType(
  CreatePricingScenarioDto,
) {}
