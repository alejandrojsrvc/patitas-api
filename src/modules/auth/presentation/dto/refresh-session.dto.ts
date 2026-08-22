import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshSessionDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(1)
  public refreshToken!: string;
}
