import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  IsDate,
  Min,
  ValidateNested,
} from 'class-validator';

export class PromotionTargetDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public productId?: string | null;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public variantId?: string | null;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public categoryId?: string | null;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public brandId?: string | null;
}

export class PromotionBundleItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public variantId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) public quantity!: number;
}

export class CreatePromotionDto {
  @ApiProperty() @IsString() public name!: string;
  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED'] })
  @IsIn(['PERCENTAGE', 'FIXED'])
  public type!: 'PERCENTAGE' | 'FIXED';
  @ApiPropertyOptional({ enum: ['DISCOUNT', 'BUNDLE'] })
  @IsOptional()
  @IsIn(['DISCOUNT', 'BUNDLE'])
  public kind?: 'DISCOUNT' | 'BUNDLE';
  @ApiProperty() @IsNumberString() public value!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public startsAt?: Date | null;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public endsAt?: Date | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() public priority?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public minimumSubtotal?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) public maxRedemptions?:
    number | null;
  @ApiPropertyOptional({ type: [PromotionTargetDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PromotionTargetDto)
  public targets?: PromotionTargetDto[];
  @ApiPropertyOptional({
    type: [PromotionBundleItemDto],
    description: 'Componentes de un combo y cantidad requerida.',
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PromotionBundleItemDto)
  public bundleItems?: PromotionBundleItemDto[];
}
export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}
export class CreateCouponDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public promotionId!: string;
  @ApiProperty() @IsString() public code!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public startsAt?: Date | null;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public endsAt?: Date | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) public maxRedemptions?:
    number | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  public perCustomerLimit?: number | null;
}
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
