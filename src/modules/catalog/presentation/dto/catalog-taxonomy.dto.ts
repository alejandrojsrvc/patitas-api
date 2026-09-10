import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CatalogTaxonomyResolveQueryDto {
  @ApiProperty({ example: '/perros/alimentos-balanceados/adultos/royal-canin' })
  @Transform(({ value }): string | undefined => (typeof value === 'string' ? value.trim() : undefined))
  @IsString()
  @MaxLength(320)
  @Matches(/^\/[a-z0-9]+(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/)
  public path!: string;
}
