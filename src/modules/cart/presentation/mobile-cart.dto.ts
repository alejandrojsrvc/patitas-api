import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { SetCartItemDto, MergeCartDto } from './cart.dto';

export class MobileCartItemContextDto {
  @ApiPropertyOptional({ enum: ['MAIN', 'EXTRA'], default: 'EXTRA' })
  @IsOptional()
  @IsIn(['MAIN', 'EXTRA'])
  public role: 'MAIN' | 'EXTRA' = 'EXTRA';

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public petId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  public planId?: string | null;
}

export class SetMobileCartItemDto extends SetCartItemDto {
  @ApiPropertyOptional({ enum: ['MAIN', 'EXTRA'], default: 'EXTRA' })
  @IsOptional()
  @IsIn(['MAIN', 'EXTRA'])
  public role: 'MAIN' | 'EXTRA' = 'EXTRA';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public petId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public planId?: string;

  @ApiPropertyOptional({ type: MobileCartItemContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileCartItemContextDto)
  public context?: MobileCartItemContextDto;
}

export class MergeMobileCartDto extends MergeCartDto {}
