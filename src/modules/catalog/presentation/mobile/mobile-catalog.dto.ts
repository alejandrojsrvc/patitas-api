import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class MobileCatalogQueryDto {
  @ApiPropertyOptional({ description: 'Texto libre de búsqueda.' })
  @IsOptional()
  @IsString()
  public query?: string;

  @ApiPropertyOptional({ description: 'Alias compatible con el catálogo Web.' })
  @IsOptional()
  @IsString()
  public q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public category?: string;

  @ApiPropertyOptional({ enum: ['dog', 'cat'] })
  @IsOptional()
  @IsIn(['dog', 'cat'])
  public species?: 'dog' | 'cat';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  public featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  public previouslyPurchased?: boolean;

  @ApiPropertyOptional({ description: 'Código postal argentino.' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:[cC]?\d{4})$/)
  public postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public cursor?: string;

  @ApiPropertyOptional({ default: 24, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 24))
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 24;
}

export class MobileCategoriesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public cursor?: string;

  @ApiPropertyOptional({ default: 24, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 24))
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 24;
}

const parseBoolean = (value: unknown): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};
