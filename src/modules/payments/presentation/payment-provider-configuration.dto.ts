import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePaymentProviderConfigurationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  public priority?: number;
}
