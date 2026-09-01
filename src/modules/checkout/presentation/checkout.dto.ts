import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorefrontShellResponseDto } from '../../storefront/presentation/storefront-response.dto';

export class CreateCheckoutSessionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public cartId!: string;
}
export class ContactStepDto {
  @ApiProperty() @IsString() @MaxLength(160) public contactName!: string;
  @ApiProperty() @IsEmail() @MaxLength(320) public contactEmail!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public contactPhone?: string | null;
}
export class ShippingAddressDto {
  [key: string]: string | undefined;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  public recipientName!: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  public street!: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  public number!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public apartment?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public neighborhood?: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public city!: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public province!: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  public postalCode!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  public reference?: string;
}

export class ShippingAddressStepDto {
  @ApiProperty({ type: Object })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  public address!: ShippingAddressDto;
}

export class ShippingOptionStepDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public shippingOptionId!: string;
  @ApiPropertyOptional({ example: 'MORNING' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public deliverySlotId?: string;
}
export class PaymentMethodStepDto {
  @ApiProperty({
    enum: [
      'SIMULATED_CARD',
      'SIMULATED_TRANSFER',
      'SIMULATED_CASH',
      'MERCADO_PAGO',
      'PAYWAY',
    ],
  })
  @IsIn([
    'SIMULATED_CARD',
    'SIMULATED_TRANSFER',
    'SIMULATED_CASH',
    'MERCADO_PAGO',
    'PAYWAY',
  ])
  public paymentMethod!:
    | 'SIMULATED_CARD'
    | 'SIMULATED_TRANSFER'
    | 'SIMULATED_CASH'
    | 'MERCADO_PAGO'
    | 'PAYWAY';
}
export class PaywayPaymentDto {
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
export class ConfirmCheckoutDto {
  @ApiPropertyOptional({ type: PaywayPaymentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaywayPaymentDto)
  public payment?: PaywayPaymentDto;
}
export class CouponDto {
  @ApiProperty() @IsString() @MaxLength(80) public code!: string;
}

export class CheckoutShippingOptionResponseDto {
  @ApiProperty() public id!: string;
  @ApiProperty({ example: '0.00' }) public cost!: string;
  @ApiProperty({ type: [Object] }) public deliverySlots!: Array<
    Record<string, unknown>
  >;
}

export class CheckoutMutationResponseDto {
  @ApiProperty({ type: Object }) public session!: Record<string, unknown>;
  @ApiProperty({ type: [CheckoutShippingOptionResponseDto] })
  public shippingOptions!: CheckoutShippingOptionResponseDto[];
}

export class CheckoutScreenResponseDto extends CheckoutMutationResponseDto {
  @ApiProperty({ type: StorefrontShellResponseDto })
  public shell!: StorefrontShellResponseDto;
  @ApiProperty({ type: [Object] })
  public paymentMethods!: Array<Record<string, unknown>>;
  @ApiProperty({ type: [Object] })
  public savedAddresses!: Array<Record<string, unknown>>;
}

export class CheckoutConflictResponseDto {
  @ApiProperty({ example: 409 }) public statusCode!: 409;
  @ApiProperty({ example: 'CHECKOUT_CONFLICT' }) public code!: string;
  @ApiProperty() public message!: string;
  @ApiPropertyOptional({ nullable: true }) public requestId!: string | null;
  @ApiPropertyOptional({ nullable: true }) public traceId!: string | null;
  @ApiPropertyOptional({ type: CheckoutMutationResponseDto })
  public currentState?: CheckoutMutationResponseDto;
}
