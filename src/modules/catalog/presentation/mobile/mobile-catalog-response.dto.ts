import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MobileReferenceResponseDto {
  @ApiProperty() public id!: string;
  @ApiProperty() public name!: string;
  @ApiProperty() public slug!: string;
}

export class MobileCategoryResponseDto extends MobileReferenceResponseDto {
  @ApiPropertyOptional({ nullable: true }) public parentId!: string | null;
  @ApiProperty() public sortOrder!: number;
}

export class MobileImageResponseDto {
  @ApiProperty() public url!: string;
  @ApiProperty() public altText!: string;
}

export class MobileMoneyResponseDto {
  @ApiProperty() public amount!: string;
  @ApiProperty({ example: 'ARS' }) public currency!: 'ARS';
}

export class MobileFulfillmentResponseDto {
  @ApiProperty({ enum: ['IN_STOCK', 'ON_REQUEST', 'OUT_OF_STOCK'] })
  public status!: string;
  @ApiProperty() public purchasable!: boolean;
  @ApiPropertyOptional({ nullable: true }) public leadTimeHours!: number | null;
  @ApiProperty({ enum: ['TODAY', 'TOMORROW', 'OUT_OF_STOCK'] })
  public availability!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  public earliestDeliveryDate!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'time' })
  public orderBefore!: string | null;
}

export class MobileVariantResponseDto {
  @ApiProperty() public id!: string;
  @ApiProperty() public sku!: string;
  @ApiPropertyOptional({ nullable: true }) public presentation!: string | null;
  @ApiPropertyOptional({ nullable: true }) public weightGrams!: number | null;
  @ApiProperty() public salePrice!: string;
  @ApiPropertyOptional({ nullable: true }) public compareAtPrice!:
    string | null;
  @ApiProperty({ example: 'ARS' }) public currency!: 'ARS';
  @ApiProperty({ type: MobileFulfillmentResponseDto })
  public fulfillment!: MobileFulfillmentResponseDto;
}

export class MobileProductResponseDto {
  @ApiProperty() public id!: string;
  @ApiProperty() public name!: string;
  @ApiProperty() public slug!: string;
  @ApiPropertyOptional({ nullable: true }) public description!: string | null;
  @ApiPropertyOptional({ nullable: true }) public species!: string | null;
  @ApiProperty({ type: MobileReferenceResponseDto })
  public brand!: MobileReferenceResponseDto;
  @ApiPropertyOptional({ type: MobileReferenceResponseDto, nullable: true })
  public category!: MobileReferenceResponseDto | null;
  @ApiPropertyOptional({ type: MobileImageResponseDto, nullable: true })
  public image!: MobileImageResponseDto | null;
  @ApiProperty({ type: [MobileImageResponseDto] })
  public images!: MobileImageResponseDto[];
  @ApiProperty({ type: [MobileVariantResponseDto] })
  public variants!: MobileVariantResponseDto[];
}

export class MobileOfferResponseDto {
  @ApiProperty() public id!: string;
  @ApiProperty() public type!: string;
  @ApiProperty() public title!: string;
  @ApiProperty() public description!: string;
  @ApiPropertyOptional({ nullable: true }) public percentage!: string | null;
  @ApiPropertyOptional({ nullable: true }) public amount!: string | null;
  @ApiPropertyOptional({ nullable: true }) public currency!: 'ARS' | null;
  @ApiProperty() public appliesAutomatically!: boolean;
  @ApiPropertyOptional({ nullable: true }) public startsAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) public endsAt!: Date | null;
}

export class MobileCursorPageResponseDto<T = unknown> {
  @ApiProperty({ type: [Object] }) public items!: T[];
  @ApiPropertyOptional({ nullable: true }) public nextCursor!: string | null;
}
