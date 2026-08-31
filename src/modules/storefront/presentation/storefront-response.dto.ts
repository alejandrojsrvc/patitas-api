import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StorefrontViewerResponseDto {
  @ApiProperty() public authenticated!: boolean;
  @ApiPropertyOptional({ format: 'uuid' }) public id?: string;
  @ApiPropertyOptional() public email?: string;
  @ApiPropertyOptional() public displayName?: string;
  @ApiPropertyOptional() public role?: string;
}

export class StorefrontLocationResponseDto {
  @ApiProperty() public label!: string;
  @ApiProperty() public street!: string;
  @ApiProperty() public number!: string;
  @ApiPropertyOptional({ nullable: true }) public apartment!: string | null;
  @ApiProperty() public city!: string;
  @ApiProperty() public province!: string;
  @ApiProperty() public postalCode!: string;
}

export class StorefrontCartSummaryResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) public id!:
    string | null;
  @ApiProperty() public itemCount!: number;
  @ApiProperty({ example: '0.00' }) public subtotal!: string;
  @ApiProperty({ example: 'ARS' }) public currency!: 'ARS';
}

export class StorefrontShellResponseDto {
  @ApiProperty({ type: StorefrontViewerResponseDto })
  public viewer!: StorefrontViewerResponseDto;
  @ApiPropertyOptional({
    type: StorefrontLocationResponseDto,
    nullable: true,
  })
  public location!: StorefrontLocationResponseDto | null;
  @ApiProperty({ type: StorefrontCartSummaryResponseDto })
  public cart!: StorefrontCartSummaryResponseDto;
}

export class CartScreenResponseDto {
  @ApiProperty({ type: StorefrontShellResponseDto })
  public shell!: StorefrontShellResponseDto;
  @ApiPropertyOptional({ type: Object, nullable: true })
  public cart!: Record<string, unknown> | null;
}

export class AccountScreenResponseDto {
  @ApiProperty({ type: StorefrontShellResponseDto })
  public shell!: StorefrontShellResponseDto;
  @ApiProperty({ type: Object }) public profile!: Record<string, unknown>;
  @ApiProperty({
    type: Object,
    description:
      'Unión discriminada por type: overview, orders, order-detail, addresses, pets o replenishments.',
  })
  public section!: Record<string, unknown>;
}
