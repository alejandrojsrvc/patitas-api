import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumberString, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class TransferInstructionsDto {
  @ApiProperty() @IsString() @MaxLength(160) public accountHolder!: string;
  @ApiProperty() @IsString() @MaxLength(160) public bank!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public alias?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) public cbu?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string | null;
}

export class UpdateTransferConfigurationDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public enabled?: boolean;
  @ApiPropertyOptional({ example: '3.00' })
  @IsOptional()
  @IsNumberString()
  public discountPercent?: string;
  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  public expirationMinutes?: number;
  @ApiPropertyOptional({ type: TransferInstructionsDto })
  @IsOptional()
  @IsObject()
  public instructions?: TransferInstructionsDto | null;
}
