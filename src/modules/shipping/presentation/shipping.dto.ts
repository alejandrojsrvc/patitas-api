import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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
export class UpdateShippingOptionDto extends PartialType(
  CreateShippingOptionDto,
) {}

export class CreateShippingZoneDto {
  @ApiProperty() @IsString() @MaxLength(120) public name!: string;
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
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) public maxWeightGrams?:
    number | null;
  @ApiProperty() @IsInt() @Min(0) public estimatedDaysMin!: number;
  @ApiProperty() @IsInt() @Min(0) public estimatedDaysMax!: number;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public deliveryWindows?: unknown;
}
export class UpdateShippingZoneDto extends PartialType(CreateShippingZoneDto) {}

export class ShippingDeliverySlotDto {
  @ApiProperty({ example: 'MORNING' })
  @IsString()
  @MaxLength(40)
  public id!: string;
  @ApiProperty({ example: '10:00 a 12:00' })
  @IsString()
  @MaxLength(80)
  public label!: string;
  @ApiProperty({ example: '10:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  public start!: string;
  @ApiProperty({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  public end!: string;
}

export class ShippingDeliveryWindowsDto {
  @ApiProperty({ type: [ShippingDeliverySlotDto], minItems: 2, maxItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
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
  @ApiProperty({ example: 'America/Argentina/Buenos_Aires' })
  @IsString()
  public timezone!: string;
}
