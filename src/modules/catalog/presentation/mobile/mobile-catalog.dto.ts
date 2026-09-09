import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class MobileCatalogQueryDto {
  @ApiPropertyOptional({ description: 'Texto libre de búsqueda.', maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsString()
  @MaxLength(80)
  public query?: string;

  @ApiPropertyOptional({ description: 'Alias compatible con el catálogo Web.', maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsString()
  @MaxLength(80)
  public q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsString()
  @MaxLength(220)
  public category?: string;

  @ApiPropertyOptional({ enum: ['dog', 'cat'] })
  @IsOptional()
  @IsIn(['dog', 'cat'])
  public species?: 'dog' | 'cat';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsString()
  @MaxLength(220)
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
  @MaxLength(1_024)
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
  @MaxLength(1_024)
  public cursor?: string;

  @ApiPropertyOptional({ default: 24, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 24))
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 24;
}

export class MobileProductAutocompleteQueryDto {
  @ApiPropertyOptional({
    description: 'Prefijo del producto, marca o presentación.',
    maxLength: 80,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  public q?: string;
}

const parseBoolean = (value: unknown): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

const normalizeQueryText = (value: unknown): unknown => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
