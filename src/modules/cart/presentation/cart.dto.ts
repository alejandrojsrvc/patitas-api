import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class SetCartItemDto {
  @ApiProperty({ minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  public quantity!: number;

  @ApiPropertyOptional({ enum: ['MAIN', 'EXTRA'] })
  @IsOptional()
  @IsIn(['MAIN', 'EXTRA'])
  public role?: 'MAIN' | 'EXTRA';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public petId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public planId?: string;
}

export class UpdateCartLineDto {
  @ApiProperty({ minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  public quantity!: number;
}

export class CartQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public customerId?: string;
}

export class MergeCartDto {
  @ApiProperty({
    description: 'Token anónimo del carrito que se desea fusionar.',
  })
  @IsString()
  @MinLength(1)
  public cartToken!: string;
}
