import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class InitiatePaywayPaymentDto {
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

export class RefundPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  public amount?: string;
}
