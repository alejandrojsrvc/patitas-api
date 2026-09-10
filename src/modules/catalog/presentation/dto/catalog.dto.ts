import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
  Max,
  MaxLength,
  MinLength,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { FoodType, LifeStage, ProductCategory, Species, type CatalogAvailability } from '../../domain/catalog.types';
import { normalizeCatalogLifeStage, normalizeCatalogSpecies } from '../../domain/catalog-classification';

export class ReferenceDto {
  @ApiProperty() @IsString() @MaxLength(160) public name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  public slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() public description?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  public ingredientsText?: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  public analyticalComposition?: Record<string, unknown> | null;
  @ApiPropertyOptional() @IsOptional() @IsString() public seoTitle?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() public seoDescription?: string | null;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public displayOrder?: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public parentId?: string | null;
}
export class UpdateReferenceDto extends PartialType(ReferenceDto) {}

export class BrandReferenceDto extends ReferenceDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public logoUrl?: string | null;
}

export class UpdateBrandReferenceDto extends PartialType(BrandReferenceDto) {}

export class CreateProductDto {
  @ApiProperty() @IsString() @MaxLength(200) public name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(220)
  public slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() public description?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  public ingredientsText?: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  public analyticalComposition?: Record<string, unknown> | null;
  @ApiProperty({ format: 'uuid' }) @IsUUID() public brandId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() public categoryId!: string;
  @ApiPropertyOptional({ enum: Object.values(Species), nullable: true })
  @IsOptional()
  @Transform(({ value }) => normalizeEnumInput(value, normalizeCatalogSpecies))
  @IsIn(Object.values(Species))
  public species?: Species | null;
  @ApiPropertyOptional() @IsOptional() @IsString() public line?: string | null;
  @ApiPropertyOptional({ enum: Object.values(LifeStage), nullable: true })
  @IsOptional()
  @Transform(({ value }) => normalizeEnumInput(value, normalizeCatalogLifeStage))
  @IsIn(Object.values(LifeStage))
  public lifeStage?: LifeStage | null;
  @ApiPropertyOptional() @IsOptional() @IsString() public breedSize?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public estimatedDailyGramsPerKg?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  public featuredRank?: number | null;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  public status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export class CreateVariantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) public sku?: string | null;
  @ApiPropertyOptional({ description: 'Código EAN/GTIN del fabricante' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8,14}$/)
  public barcode?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public presentation?: string | null;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) public weightGrams!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public active?: boolean;
}
export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumberString()
  public salePrice?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public compareAtPrice?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public preferredSupplierOfferId?: string | null;
}

export class CreateProductMediaDto {
  @ApiProperty() @IsString() @MaxLength(2_000) public url!: string;
  @ApiProperty() @IsString() @MaxLength(300) public altText!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public variantId?: string | null;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public displayOrder?: number;
}

export class UpdateProductMediaDto {
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  public altText?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public variantId?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public displayOrder?: number;
}

export class UploadProductMediaDto {
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  public altText?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public variantId?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public displayOrder?: number;
}

export class FeedingGuideEntryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  public petWeightKgMin!: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  public petWeightKgMax?: number | null;
  @ApiPropertyOptional({ enum: Object.values(LifeStage), nullable: true })
  @IsOptional()
  @Transform(({ value }) => normalizeEnumInput(value, normalizeCatalogLifeStage))
  @IsIn(Object.values(LifeStage))
  public lifeStage?: LifeStage | null;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public conditions?: Record<string, string>;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  public dailyGramsMin!: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  public dailyGramsMax?: number | null;
}

export class ReplaceFeedingGuideDto {
  @ApiProperty() @IsString() @MaxLength(200) public sourceLabel!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  public sourceUrl?: string | null;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public requiredDimensions?: Record<string, string[]>;
  @ApiProperty({ type: [FeedingGuideEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedingGuideEntryDto)
  public entries!: FeedingGuideEntryDto[];
}

export class SetInventoryDto {
  @ApiProperty() @IsInt() @Min(0) public onHand!: number;
  @ApiProperty() @IsInt() @Min(0) public reserved!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  public reason?: string | null;
}

export class PublicProductsQueryDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsString()
  @MaxLength(80)
  public q?: string;
  @ApiPropertyOptional({ enum: Object.values(ProductCategory) })
  @IsOptional()
  @IsIn(Object.values(ProductCategory))
  public category?: ProductCategory;
  @ApiPropertyOptional({ enum: Object.values(FoodType) })
  @IsOptional()
  @IsIn(Object.values(FoodType))
  public foodType?: FoodType;
  @ApiPropertyOptional({ maxLength: 220 })
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsString()
  @MaxLength(220)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  public categorySlug?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(220, { each: true })
  public brand?: string[];
  @ApiPropertyOptional({ enum: Object.values(Species) })
  @IsOptional()
  @IsIn(Object.values(Species))
  public species?: Species;
  @ApiPropertyOptional({ enum: Object.values(LifeStage), isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @ArrayMaxSize(20)
  @IsIn(Object.values(LifeStage), { each: true })
  public lifeStage?: LifeStage[];
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @Transform(({ value }) => toArray(value).map(Number))
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(100_000, { each: true })
  public weightGrams?: number[];
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsNumberString()
  @MaxLength(24)
  public minPrice?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeQueryText(value))
  @IsNumberString()
  @MaxLength(24)
  public maxPrice?: string;
  @ApiPropertyOptional({ enum: ['AVAILABLE', 'OUT_OF_STOCK'] })
  @IsOptional()
  @IsIn(['AVAILABLE', 'OUT_OF_STOCK'])
  public availability?: CatalogAvailability;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  public featured?: boolean;
  @ApiPropertyOptional({
    enum: ['featured', 'name_asc', 'price_asc', 'price_desc'],
  })
  @IsOptional()
  @IsIn(['featured', 'name_asc', 'price_asc', 'price_desc'])
  public sort?: 'featured' | 'name_asc' | 'price_asc' | 'price_desc';
  @ApiPropertyOptional({ default: 1, maximum: 250 })
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  @Max(250)
  public page = 1;
  @ApiPropertyOptional({ default: 24, maximum: 100 })
  @Transform(({ value }) => Number(value ?? 24))
  @IsInt()
  @Min(1)
  @Max(100)
  public perPage = 24;
}

export class PublicProductAutocompleteQueryDto {
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

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    const values: unknown[] = value;
    return values.flatMap((item) => (typeof item === 'string' ? item.split(',') : [item])).map(trimString);
  }
  if (typeof value === 'string')
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  return [value];
};

const trimString = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value);

const normalizeQueryText = (value: unknown): unknown => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

const parseBoolean = (value: unknown): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

const normalizeEnumInput = <T extends string>(value: unknown, normalize: (input: unknown) => T | null): unknown => {
  if (value === undefined || value === null || value === '') return value;
  return normalize(value) ?? value;
};

export class AdminProductsQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  public status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  @ApiPropertyOptional() @IsOptional() @IsString() public q?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public brandId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public categoryId?: string;
  @ApiPropertyOptional({ enum: Object.values(Species) })
  @IsOptional()
  @Transform(({ value }) => normalizeEnumInput(value, normalizeCatalogSpecies))
  @IsIn(Object.values(Species))
  public species?: Species;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  public hasStock?: boolean;
  @ApiPropertyOptional({ enum: ['name_asc', 'name_desc', 'updated_desc'] })
  @IsOptional()
  @IsIn(['name_asc', 'name_desc', 'updated_desc'])
  public sort?: 'name_asc' | 'name_desc' | 'updated_desc';
  @Transform(({ value }) => Number(value ?? 1)) @IsInt() @Min(1) public page = 1;
  @Transform(({ value }) => Number(value ?? 24))
  @IsInt()
  @Min(1)
  @Max(100)
  public perPage = 24;
}

export class FoodDurationQueryDto {
  @ApiProperty() @IsString() public productSlug!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() public variantId!: string;
  @ApiProperty()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.1)
  public petWeightKg!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() public lifeStage?: string;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public attributes?: Record<string, string>;
}
