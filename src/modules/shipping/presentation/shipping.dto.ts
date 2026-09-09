import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PublicShippingQuoteQueryDto {
  @ApiPropertyOptional({ description: 'Código postal argentino.' })
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @Matches(/^(?:[cC]?\d{4})$/)
  public postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MaxLength(120)
  public neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MaxLength(120)
  public city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MaxLength(120)
  public province?: string;

  @ApiPropertyOptional({ default: '0' })
  @MaxLength(24)
  public subtotal = '0';

  @ApiPropertyOptional({ minimum: 1, maximum: 100_000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100_000)
  public weightGrams?: number;
}

export class CreateShippingOptionDto {
  @ApiProperty() @IsString() @MaxLength(120) public name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  public description?: string | null;
  @ApiProperty() @IsNumberString() public cost!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  public displayOrder?: number;
}
export class UpdateShippingOptionDto extends PartialType(CreateShippingOptionDto) {}

export class CreateShippingZoneDto {
  @ApiProperty() @IsString() @MaxLength(120) public name!: string;
  @ApiProperty({ enum: ['AMBA', 'CABA'] })
  @IsIn(['AMBA', 'CABA'])
  public region!: 'AMBA' | 'CABA';
  @ApiProperty({ enum: ['POSTAL_CODE', 'NEIGHBORHOOD', 'POLYGON'] })
  @IsIn(['POSTAL_CODE', 'NEIGHBORHOOD', 'POLYGON'])
  public type!: 'POSTAL_CODE' | 'NEIGHBORHOOD' | 'POLYGON';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() public priority?: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public postalCodes?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public neighborhoods?: string[];
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public polygon?: unknown;
  @ApiProperty() @IsNumberString() public cost!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public freeShippingFrom?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) public maxWeightGrams?: number | null;
  @ApiProperty() @IsInt() @Min(0) public estimatedDaysMin!: number;
  @ApiProperty() @IsInt() @Min(0) public estimatedDaysMax!: number;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public deliveryWindows?: unknown;
}
export class UpdateShippingZoneDto extends PartialType(CreateShippingZoneDto) {}

export class ShippingDeliverySlotDto {
  @ApiProperty({ example: 'STANDARD_13_19' })
  @IsString()
  @MaxLength(40)
  public id!: string;
  @ApiProperty({ example: '13:00 a 19:00' })
  @IsString()
  @MaxLength(80)
  public label!: string;
  @ApiProperty({ example: '13:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  public start!: string;
  @ApiProperty({ example: '19:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  public end!: string;
}

export class ShippingCollectionCutoffDto {
  @ApiProperty({ example: '13:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  public time!: string;

  @ApiProperty({ enum: ['AMBA', 'CABA'] })
  @IsIn(['AMBA', 'CABA'])
  public coverage!: 'AMBA' | 'CABA';
}

export class ShippingDeliveryWindowsDto {
  @ApiProperty({ type: [ShippingDeliverySlotDto], minItems: 1, maxItems: 6 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ShippingDeliverySlotDto)
  public deliverySlots!: ShippingDeliverySlotDto[];
  @ApiProperty({ example: [1, 2, 3, 4, 5], type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  public daysOfWeek!: number[];
  @ApiProperty({ example: '13:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  public cutoff!: string;
  @ApiPropertyOptional({ type: [ShippingCollectionCutoffDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ShippingCollectionCutoffDto)
  public collectionCutoffs?: ShippingCollectionCutoffDto[];
  @ApiProperty({ example: 'America/Argentina/Buenos_Aires' })
  @IsString()
  public timezone!: string;
}

const normalizeText = (value: unknown): unknown => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
