import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class TransitionShipmentDto {
  @ApiProperty({ enum: ['PENDING', 'PREPARING', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'] })
  @IsIn(['PENDING', 'PREPARING', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'])
  public status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) public message?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) public carrier?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) public trackingNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) public trackingUrl?: string;
}

export class ChangeOrderAddressDto {
  @ApiProperty({ type: Object }) @IsObject() public address!: Record<string, string>;
}
