import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class MobileEstimatePetDto {
  @IsOptional() @IsUUID() public id?: string;
  @IsString() @MaxLength(80) public name!: string;
  @IsIn(['dog', 'cat']) public species!: 'dog' | 'cat';
  @IsNumber() public weightKg!: number;
  @IsIn(['puppy', 'adult', 'senior'])
  public lifeStage!: 'puppy' | 'adult' | 'senior';
  @IsOptional() @IsString() @MaxLength(80) public breed?: string | null;
}

class MobileEstimateCustomFoodDto {
  @IsString() @MaxLength(80) public brand!: string;
  @IsString() @MaxLength(160) public name!: string;
  @IsNumber() public weightGrams!: number;
}

class MobileEstimateFoodDto {
  @IsOptional() @IsUUID() public productId?: string;
  @IsOptional() @IsUUID() public variantId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileEstimateCustomFoodDto)
  public custom?: MobileEstimateCustomFoodDto;
}

export class CreateMobileEstimateDto {
  @IsOptional() @IsUUID() public petId?: string;
  @IsOptional() @IsUUID() public variantId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileEstimatePetDto)
  public pet?: MobileEstimatePetDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileEstimateFoodDto)
  public food?: MobileEstimateFoodDto;
  @IsOptional() @IsDateString() public bagStartedAt?: string;
  @IsOptional()
  @IsIn([
    'ALMOST_FULL',
    'MORE_THAN_HALF',
    'ABOUT_HALF',
    'ALMOST_EMPTY',
    'FINISHED',
  ])
  public remainingBucket?:
    | 'ALMOST_FULL'
    | 'MORE_THAN_HALF'
    | 'ABOUT_HALF'
    | 'ALMOST_EMPTY'
    | 'FINISHED';
}
