import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { AccountSection } from '../application/account-query.service';

const accountSections: AccountSection[] = [
  'overview',
  'orders',
  'addresses',
  'pets',
  'replenishments',
];

export class AccountScreenQueryDto {
  @ApiPropertyOptional({ enum: accountSections, default: 'overview' })
  @IsOptional()
  @IsIn(accountSections)
  public section: AccountSection = 'overview';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public orderId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  public page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @Transform(({ value }) => Number(value ?? 10))
  @IsInt()
  @Min(1)
  @Max(50)
  public perPage = 10;
}
