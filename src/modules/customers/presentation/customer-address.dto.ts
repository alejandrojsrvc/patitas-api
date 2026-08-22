import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerAddressDto {
  @ApiProperty() @IsString() @MaxLength(80) public label!: string;
  @ApiProperty() @IsString() @MaxLength(160) public recipientName!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public phone?: string | null;
  @ApiProperty() @IsString() @MaxLength(120) public street!: string;
  @ApiProperty() @IsString() @MaxLength(30) public number!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public apartment?: string | null;
  @ApiProperty() @IsString() @MaxLength(100) public city!: string;
  @ApiProperty() @IsString() @MaxLength(100) public province!: string;
  @ApiProperty() @IsString() @MaxLength(20) public postalCode!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  public reference?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public isDefault?: boolean;
}

export class UpdateCustomerAddressDto extends PartialType(
  CreateCustomerAddressDto,
) {}
