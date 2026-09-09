import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePetDto {
  @ApiProperty() @IsString() @MaxLength(80) public name!: string;
  @ApiProperty({ enum: ['dog', 'cat'] }) @IsIn(['dog', 'cat']) public species!: 'dog' | 'cat';
  @ApiProperty() @IsNumberString() public weightKg!: string;
  @ApiProperty({ enum: ['puppy', 'adult', 'senior'] })
  @IsIn(['puppy', 'adult', 'senior'])
  public lifeStage!: 'puppy' | 'adult' | 'senior';
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public breed?: string | null;
}

export class UpdatePetDto extends PartialType(CreatePetDto) {}

export class SetPetCurrentFoodDto {
  @ApiProperty({ enum: ['catalog', 'custom', 'none'] })
  @IsIn(['catalog', 'custom', 'none'])
  public source!: 'catalog' | 'custom' | 'none';
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() public productId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() public variantId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) public brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) public name?: string;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1) public weightGrams?: number;
}
