import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpdateFulfillmentSettingsDto {
  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  public timezone?: string;
  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  public depotCutoff?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public sameDayEnabled?: boolean;
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public depotHandlingMinutes?: number;
}
