import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderLineDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public variantId!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) public quantity!: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public customerId?: string;
  @ApiProperty() @IsString() @MaxLength(160) public contactName!: string;
  @ApiProperty() @IsEmail() @MaxLength(320) public contactEmail!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public contactPhone?: string | null;
  @ApiProperty({ type: Object }) @IsObject() public shippingAddress!: Record<
    string,
    string
  >;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public shippingCost?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() public notes?: string | null;
  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  public lines!: OrderLineDto[];
}

export class UpdateOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  public contactName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  public contactEmail?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public contactPhone?: string | null;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public shippingAddress?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsString() public notes?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public trackingNumber?: string | null;
}

export class RegisterPaymentDto {
  @ApiProperty() @IsNumberString() public amount!: string;
  @ApiProperty() @IsString() @MaxLength(80) public method!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  public reference?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public proofUrl?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  public paidAt?: string | null;
}

export class TransitionOrderDto {
  @ApiProperty({
    enum: [
      'DRAFT',
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ],
  })
  @IsIn([
    'DRAFT',
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
  ])
  public status!:
    | 'DRAFT'
    | 'PENDING_PAYMENT'
    | 'PAID'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED';
}

export class OrdersQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() public q?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public customerId?: string;
  @ApiPropertyOptional({
    enum: [
      'DRAFT',
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ],
  })
  @IsOptional()
  @IsIn([
    'DRAFT',
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
  ])
  public status?: TransitionOrderDto['status'];
  @ApiPropertyOptional({
    enum: [
      'UNPAID',
      'PENDING',
      'PROCESSING',
      'PAID',
      'FAILED',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
      'CHARGED_BACK',
    ],
  })
  @IsOptional()
  @IsIn([
    'UNPAID',
    'PENDING',
    'PROCESSING',
    'PAID',
    'FAILED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CHARGED_BACK',
  ])
  public paymentStatus?:
    | 'UNPAID'
    | 'PENDING'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'PARTIALLY_REFUNDED'
    | 'REFUNDED'
    | 'CHARGED_BACK';
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  public page = 1;
  @ApiPropertyOptional({ default: 24, maximum: 100 })
  @Transform(({ value }) => Number(value ?? 24))
  @IsInt()
  @Min(1)
  @Max(100)
  public perPage = 24;
}
