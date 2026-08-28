import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class EstimatePetDto {
  @IsOptional() @IsUUID() public id?: string;
  @IsString() @MaxLength(80) public name!: string;
  @IsString() @MaxLength(20) public species!: string;
  @IsNumber() public weightKg!: number;
  @IsString() @MaxLength(40) public lifeStage!: string;
  @IsOptional() @IsString() @MaxLength(80) public breed?: string | null;
}

class EstimateCustomFoodDto {
  @IsString() @MaxLength(80) public brand!: string;
  @IsString() @MaxLength(160) public name!: string;
  @IsNumber() public weightGrams!: number;
}

class EstimateFoodDto {
  @IsOptional() @IsUUID() public productId?: string;
  @IsOptional() @IsUUID() public variantId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => EstimateCustomFoodDto)
  public custom?: EstimateCustomFoodDto;
}

export class CreateEstimateDto {
  @ValidateNested() @Type(() => EstimatePetDto) public pet!: EstimatePetDto;
  @ValidateNested() @Type(() => EstimateFoodDto) public food!: EstimateFoodDto;
}
