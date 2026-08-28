import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePetDto {
  @ApiProperty() @IsString() @MaxLength(80) public name!: string;
  @ApiProperty({ enum: ['dog', 'cat'] }) @IsIn(['dog', 'cat']) public species!:
    'dog' | 'cat';
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
