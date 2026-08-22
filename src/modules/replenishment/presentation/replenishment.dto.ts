import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReplenishmentPlanDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public orderId?: string | null;
  @ApiProperty() @IsString() @MaxLength(80) public petName!: string;
  @ApiProperty() @IsString() @MaxLength(40) public petSpecies!: string;
  @ApiProperty() @IsNumberString() public petWeightKg!: string;
  @ApiProperty() @IsString() @MaxLength(40) public petLifeStage!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public petBreed?: string | null;
  @ApiProperty({ format: 'uuid' }) @IsUUID() public productId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() public variantId!: string;
  @ApiProperty() @IsNumberString() public dailyConsumption!: string;
  @ApiProperty() @IsString() @MaxLength(20) public consumptionUnit!: string;
  @ApiProperty() @Min(1) public durationDaysMin!: number;
  @ApiProperty() @Min(1) public durationDaysMax!: number;
  @ApiProperty() @IsString() @MaxLength(40) public calculationSource!: string;
  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  public estimatedDepletionDate!: Date;
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  public channel!: 'EMAIL' | 'WHATSAPP';
  @ApiProperty() @IsString() @MaxLength(40) public consentVersion!: string;
  @ApiProperty({
    description: 'Email o WhatsApp consentido; no se devuelve en el plan.',
  })
  @IsString()
  @MaxLength(320)
  public destination!: string;
}

export class UpdateReplenishmentStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'] })
  @IsIn(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'])
  public status!: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
}
