import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicReferenceResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public name!: string;
  @ApiProperty() public slug!: string;
  @ApiPropertyOptional({ nullable: true }) public description!: string | null;
  @ApiPropertyOptional({ nullable: true }) public seoTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) public seoDescription!:
    string | null;
}

export class PublicCategoryResponseDto extends PublicReferenceResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) public parentId!:
    string | null;
  @ApiProperty({ type: () => [PublicCategoryResponseDto] })
  public children!: PublicCategoryResponseDto[];
}

export class PublicBrandResponseDto extends PublicReferenceResponseDto {
  @ApiPropertyOptional({ nullable: true }) public logoUrl!: string | null;
}

export class PublicProductMediaResponseDto {
  @ApiProperty() public url!: string;
  @ApiProperty() public altText!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) public variantId!:
    string | null;
}

export class PublicFulfillmentResponseDto {
  @ApiProperty() public purchasable!: boolean;
  @ApiProperty({ enum: ['TODAY', 'TOMORROW', 'LATER', 'OUT_OF_STOCK'] })
  public availability!: string;
  @ApiProperty() public label!: string;
  @ApiProperty() public availableQuantity!: number;
  @ApiPropertyOptional({ nullable: true }) public orderBefore!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  public deliveryDate!: string | null;
}

export class PublicProductVariantResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public sku!: string;
  @ApiPropertyOptional({ nullable: true }) public presentation!: string | null;
  @ApiPropertyOptional({ nullable: true }) public weightGrams!: number | null;
  @ApiProperty() public salePrice!: string;
  @ApiPropertyOptional({ nullable: true }) public compareAtPrice!:
    string | null;
  @ApiProperty({ example: 'ARS' }) public currency!: 'ARS';
  @ApiProperty({ type: PublicFulfillmentResponseDto })
  public fulfillment!: PublicFulfillmentResponseDto;
}

export class PublicProductResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public name!: string;
  @ApiProperty() public slug!: string;
  @ApiPropertyOptional({ nullable: true }) public description!: string | null;
  @ApiPropertyOptional({ nullable: true }) public line!: string | null;
  @ApiPropertyOptional({ nullable: true }) public species!: string | null;
  @ApiPropertyOptional({ nullable: true }) public lifeStage!: string | null;
  @ApiPropertyOptional({ nullable: true }) public breedSize!: string | null;
  @ApiProperty({ type: PublicBrandResponseDto })
  public brand!: PublicBrandResponseDto;
  @ApiProperty({ type: PublicReferenceResponseDto })
  public category!: PublicReferenceResponseDto;
  @ApiProperty({ type: [PublicProductMediaResponseDto] })
  public media!: PublicProductMediaResponseDto[];
  @ApiProperty({ type: [PublicProductVariantResponseDto] })
  public variants!: PublicProductVariantResponseDto[];
  @ApiProperty({ type: [Object] })
  public offers!: Array<{
    id: string;
    name: string;
    type: string;
    value: string;
  }>;
}

export class PublicFeedingGuideEntryResponseDto {
  @ApiProperty({
    description: 'Compatibilidad con clientes que usan un único peso.',
  })
  public petWeightKg!: number;
  @ApiProperty() public petWeightKgMin!: number;
  @ApiPropertyOptional({ nullable: true }) public petWeightKgMax!:
    number | null;
  @ApiPropertyOptional({ nullable: true }) public lifeStage!: string | null;
  @ApiProperty({ type: Object }) public conditions!: Record<string, string>;
  @ApiProperty() public dailyGramsMin!: number;
  @ApiPropertyOptional({ nullable: true }) public dailyGramsMax!: number | null;
}

export class PublicFeedingGuideResponseDto {
  @ApiProperty() public sourceLabel!: string;
  @ApiPropertyOptional({ nullable: true }) public sourceUrl!: string | null;
  @ApiProperty({ type: Object })
  public requiredDimensions!: Record<string, string[]>;
  @ApiProperty({ type: [PublicFeedingGuideEntryResponseDto] })
  public entries!: PublicFeedingGuideEntryResponseDto[];
}

export class PublicProductTechnicalSheetResponseDto {
  @ApiPropertyOptional({ nullable: true }) public species!: string | null;
  @ApiPropertyOptional({ nullable: true }) public lifeStage!: string | null;
  @ApiPropertyOptional({ nullable: true }) public breedSize!: string | null;
  @ApiPropertyOptional({ nullable: true }) public line!: string | null;
  @ApiPropertyOptional({ nullable: true }) public ingredientsText!:
    string | null;
  @ApiPropertyOptional({ type: [Object], nullable: true })
  public analyticalComposition!: Record<string, unknown> | null;
  @ApiPropertyOptional({ nullable: true })
  public estimatedDailyGramsPerKg!: string | null;
  @ApiPropertyOptional({ type: PublicFeedingGuideResponseDto, nullable: true })
  public feedingGuide!: PublicFeedingGuideResponseDto | null;
}

export class PublicRelatedProductResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public name!: string;
  @ApiProperty() public slug!: string;
  @ApiPropertyOptional({ nullable: true }) public description!: string | null;
  @ApiProperty({ type: PublicBrandResponseDto })
  public brand!: PublicBrandResponseDto;
  @ApiPropertyOptional({ type: PublicReferenceResponseDto, nullable: true })
  public category!: PublicReferenceResponseDto | null;
  @ApiPropertyOptional({ nullable: true }) public imageUrl!: string | null;
  @ApiProperty() public startingPrice!: string;
}

export class PublicProductDetailResponseDto extends PublicProductResponseDto {
  @ApiProperty({ type: PublicProductTechnicalSheetResponseDto })
  public technicalSheet!: PublicProductTechnicalSheetResponseDto;
  @ApiProperty({ type: [PublicRelatedProductResponseDto] })
  public relatedProducts!: PublicRelatedProductResponseDto[];
}

export class PublicStringFacetOptionResponseDto {
  @ApiProperty() public value!: string;
  @ApiProperty() public label!: string;
  @ApiProperty() public count!: number;
}

export class PublicWeightFacetOptionResponseDto {
  @ApiProperty() public value!: number;
  @ApiProperty() public label!: string;
  @ApiProperty() public count!: number;
}

export class PublicBrandFacetOptionResponseDto extends PublicStringFacetOptionResponseDto {
  @ApiPropertyOptional({ nullable: true }) public logoUrl!: string | null;
}

export class PublicCategoryFacetOptionResponseDto extends PublicStringFacetOptionResponseDto {
  @ApiProperty({ type: [String] }) public species!: string[];
  @ApiProperty({ type: () => [PublicCategoryFacetOptionResponseDto] })
  public children!: PublicCategoryFacetOptionResponseDto[];
}

export class PublicProductFacetsResponseDto {
  @ApiProperty({ type: [PublicBrandFacetOptionResponseDto] })
  public brands!: PublicBrandFacetOptionResponseDto[];
  @ApiProperty({ type: [PublicCategoryFacetOptionResponseDto] })
  public categories!: PublicCategoryFacetOptionResponseDto[];
  @ApiProperty({ type: [PublicStringFacetOptionResponseDto] })
  public lifeStages!: PublicStringFacetOptionResponseDto[];
  @ApiProperty({ type: [PublicWeightFacetOptionResponseDto] })
  public weights!: PublicWeightFacetOptionResponseDto[];
}

export class PublicPageMetaResponseDto {
  @ApiProperty() public page!: number;
  @ApiProperty() public perPage!: number;
  @ApiProperty() public total!: number;
  @ApiProperty() public totalPages!: number;
}

export class PublicProductPageResponseDto {
  @ApiProperty({ type: [PublicProductResponseDto] })
  public items!: PublicProductResponseDto[];
  @ApiProperty({ type: PublicPageMetaResponseDto })
  public meta!: PublicPageMetaResponseDto;
}

export class PublicCalculatorVariantProjectionResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiPropertyOptional({ nullable: true }) public presentation!: string | null;
  @ApiPropertyOptional({ nullable: true }) public weightGrams!: number | null;
}

export class PublicCalculatorProductProjectionResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public name!: string;
  @ApiProperty() public slug!: string;
  @ApiPropertyOptional({ nullable: true }) public species!: string | null;
  @ApiPropertyOptional({ nullable: true }) public lifeStage!: string | null;
  @ApiPropertyOptional({ nullable: true })
  public estimatedDailyGramsPerKg!: string | null;
  @ApiProperty({ type: [PublicCalculatorVariantProjectionResponseDto] })
  public variants!: PublicCalculatorVariantProjectionResponseDto[];
}

export class PublicSitemapProjectionResponseDto {
  @ApiProperty() public slug!: string;
  @ApiProperty({ format: 'date-time' }) public updatedAt!: Date;
}

export class FoodDurationRangeResponseDto {
  @ApiProperty() public min!: number;
  @ApiProperty() public max!: number;
}

export class FoodDurationResponseDto {
  @ApiProperty({ enum: ['MANUFACTURER', 'GENERAL_FALLBACK'] })
  public source!: string;
  @ApiProperty() public sourceLabel!: string;
  @ApiPropertyOptional({ nullable: true }) public sourceUrl!: string | null;
  @ApiProperty() public isFallback!: boolean;
  @ApiProperty({ type: FoodDurationRangeResponseDto })
  public dailyGrams!: FoodDurationRangeResponseDto;
  @ApiProperty({ type: FoodDurationRangeResponseDto })
  public durationDays!: FoodDurationRangeResponseDto;
  @ApiProperty({ type: [String] }) public assumptions!: string[];
}
