import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SetCartItemDto {
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
