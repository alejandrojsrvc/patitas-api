import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const PAYMENT_METHODS = [
  'SIMULATED_CARD',
  'SIMULATED_TRANSFER',
  'SIMULATED_CASH',
  'MERCADO_PAGO',
  'PAYWAY',
] as const;

export class MobileCreateCheckoutSessionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public cartId!: string;
}

export class MobileCheckoutContactDto {
  @ApiProperty() @IsString() @MaxLength(160) public contactName!: string;
  @ApiProperty() @IsEmail() @MaxLength(320) public contactEmail!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public contactPhone?: string | null;
}

export class MobileCheckoutAddressDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public addressId?: string;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public address?: Record<string, string>;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public deliveryInstructions?: string | null;
}

export class MobileCheckoutShippingOptionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public shippingOptionId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public deliverySlotId?: string;
}

export class MobileCheckoutPaymentMethodDto {
  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  public paymentMethod?: (typeof PAYMENT_METHODS)[number];
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public savedPaymentMethodId?: string;
}

export class MobileCheckoutCouponDto {
  @ApiProperty() @IsString() @MaxLength(80) public code!: string;
}

export class MobilePaywayPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  public token!: string;
  @ApiProperty() @IsInt() @Min(1) public paymentMethodId!: number;
  @ApiProperty({ example: '450799' })
  @Matches(/^\d{6,8}$/)
  public bin!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) public installments!: number;
}

export class MobileConfirmCheckoutDto {
  @ApiPropertyOptional({ type: MobilePaywayPaymentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MobilePaywayPaymentDto)
  public payment?: MobilePaywayPaymentDto;
}

export class MobileSavedPaymentMethodDto {
  @ApiProperty({ enum: ['mercadopago', 'payway', 'simulated'] })
  @IsIn(['mercadopago', 'payway', 'simulated'])
  public provider!: 'mercadopago' | 'payway' | 'simulated';
  @ApiProperty({ example: 'CARD' })
  @IsString()
  @MaxLength(40)
  public type!: string;
  @ApiProperty({ description: 'ID durable de la tarjeta en el proveedor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  public providerPaymentMethodId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public brand?: string | null;
  @ApiPropertyOptional({ example: '4242' })
  @IsOptional()
  @Matches(/^\d{4}$/)
  public lastFour?: string | null;
  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  public expirationMonth?: number | null;
  @ApiPropertyOptional({ minimum: 2020 })
  @IsOptional()
  @IsInt()
  @Min(2020)
  public expirationYear?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public isDefault?: boolean;
}

export class MobileOrdersQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'delivered', 'cancelled', 'all'] })
  @IsOptional()
  @IsIn(['active', 'delivered', 'cancelled', 'all'])
  public status: 'active' | 'delivered' | 'cancelled' | 'all' = 'all';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public cursor?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  public limit = 20;
}
