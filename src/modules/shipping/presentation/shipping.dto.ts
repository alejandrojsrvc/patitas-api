import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumberString, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateShippingOptionDto {
  @ApiProperty() @IsString() @MaxLength(120) public name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) public description?: string | null;
  @ApiProperty() @IsNumberString() public cost!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) public displayOrder?: number;
}
export class UpdateShippingOptionDto extends PartialType(CreateShippingOptionDto) {}

export class CreateShippingZoneDto {
  @ApiProperty() @IsString() @MaxLength(120) public name!: string;
  @ApiProperty({ enum: ['POSTAL_CODE', 'NEIGHBORHOOD', 'POLYGON'] }) @IsIn(['POSTAL_CODE', 'NEIGHBORHOOD', 'POLYGON']) public type!: 'POSTAL_CODE' | 'NEIGHBORHOOD' | 'POLYGON';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() public priority?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) public postalCodes?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) public neighborhoods?: string[];
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() public polygon?: unknown;
  @ApiProperty() @IsNumberString() public cost!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public freeShippingFrom?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) public maxWeightGrams?: number | null;
  @ApiProperty() @IsInt() @Min(0) public estimatedDaysMin!: number;
  @ApiProperty() @IsInt() @Min(0) public estimatedDaysMax!: number;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() public deliveryWindows?: unknown;
}
export class UpdateShippingZoneDto extends PartialType(CreateShippingZoneDto) {}
