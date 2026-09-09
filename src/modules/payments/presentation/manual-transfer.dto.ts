import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportTransferDto {
  @ApiPropertyOptional({ description: 'Referencia que informó el cliente.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  public reference?: string | null;
}

export class ConfirmManualTransferDto {
  @ApiProperty({ example: '43650.00' })
  @IsNumberString()
  public amount!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  public reference?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public note?: string | null;
}
