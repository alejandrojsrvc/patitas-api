import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public cartId!: string;
}
export class ContactStepDto {
  @ApiProperty() @IsString() @MaxLength(160) public contactName!: string;
  @ApiProperty() @IsEmail() @MaxLength(320) public contactEmail!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) public contactPhone?: string | null;
}
export class ShippingAddressStepDto {
  @ApiProperty({ type: Object }) @IsObject() public address!: Record<string, string>;
}
export class ShippingOptionStepDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public shippingOptionId!: string;
}
export class PaymentMethodStepDto {
  @ApiProperty({ enum: ['SIMULATED_CARD', 'SIMULATED_TRANSFER', 'SIMULATED_CASH', 'MERCADO_PAGO'] })
  @IsIn(['SIMULATED_CARD', 'SIMULATED_TRANSFER', 'SIMULATED_CASH', 'MERCADO_PAGO'])
  public paymentMethod!: 'SIMULATED_CARD' | 'SIMULATED_TRANSFER' | 'SIMULATED_CASH';
}
export class CouponDto {
  @ApiProperty() @IsString() @MaxLength(80) public code!: string;
}
