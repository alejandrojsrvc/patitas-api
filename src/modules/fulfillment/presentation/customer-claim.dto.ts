import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerClaimDto {
  @ApiProperty({ enum: ['ADDRESS_CHANGE', 'DELIVERY_DELAY', 'MISSING_PACKAGE', 'DAMAGED_PACKAGE', 'OTHER'] })
  @IsIn(['ADDRESS_CHANGE', 'DELIVERY_DELAY', 'MISSING_PACKAGE', 'DAMAGED_PACKAGE', 'OTHER'])
  public type!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2_000) public message!: string;
}

export class UpdateCustomerClaimDto {
  @ApiProperty({ enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CANCELLED'] }) @IsIn(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CANCELLED']) public status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2_000) public resolution?: string;
}
