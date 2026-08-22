import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty() @IsString() public name!: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => parseBoolean(value)) @IsBoolean() public active?: boolean;
}

const parseBoolean = (value: unknown): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
export class CreateSupplierOfferDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public supplierId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() public variantId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() public supplierSku?: string | null;
  @ApiProperty() @IsNumberString() public unitCost!: string;
  @ApiPropertyOptional({ enum: ['AVAILABLE', 'OUT_OF_STOCK', 'ON_REQUEST', 'UNKNOWN'] })
  @IsOptional() @IsIn(['AVAILABLE', 'OUT_OF_STOCK', 'ON_REQUEST', 'UNKNOWN'])
  public stockStatus?: 'AVAILABLE' | 'OUT_OF_STOCK' | 'ON_REQUEST' | 'UNKNOWN';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) public leadTimeHours?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) public minimumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
}
export class UpdateSupplierOfferDto {
  @ApiPropertyOptional() @IsOptional() @IsString() public supplierSku?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() public unitCost?: string;
  @ApiPropertyOptional({ enum: ['AVAILABLE', 'OUT_OF_STOCK', 'ON_REQUEST', 'UNKNOWN'] })
  @IsOptional() @IsIn(['AVAILABLE', 'OUT_OF_STOCK', 'ON_REQUEST', 'UNKNOWN'])
  public stockStatus?: 'AVAILABLE' | 'OUT_OF_STOCK' | 'ON_REQUEST' | 'UNKNOWN';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) public leadTimeHours?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) public minimumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
}
export class SupplierOffersQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() public supplierId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() public variantId?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => parseBoolean(value)) @IsBoolean() public active?: boolean;
}

export class SuppliersQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() public q?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => parseBoolean(value)) @IsBoolean() public active?: boolean;
  @ApiPropertyOptional({ default: 1 }) @Transform(({ value }) => Number(value ?? 1)) @IsInt() @Min(1) public page = 1;
  @ApiPropertyOptional({ default: 24, maximum: 100 }) @Transform(({ value }) => Number(value ?? 24)) @IsInt() @Min(1) @Max(100) public perPage = 24;
}
