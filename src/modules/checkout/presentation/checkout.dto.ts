import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
export class ShippingAddressStepDto {
  @ApiProperty({ type: Object }) @IsObject() public address!: Record<
    string,
    string
  >;
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
