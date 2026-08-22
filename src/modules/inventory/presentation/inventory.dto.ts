import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class InventoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() public q?: string;
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  public page = 1;
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @Transform(({ value }) => Number(value ?? 25))
  @IsInt()
  @Min(1)
  @Max(100)
  public perPage = 25;
}
export class InventoryAdjustmentDto {
  @ApiProperty() @IsInt() public quantityDelta!: number;
  @ApiProperty() @IsString() @MaxLength(300) public reason!: string;
}
