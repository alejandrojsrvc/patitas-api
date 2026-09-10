import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GuestOrderActivationService } from '../application/guest-order-activation.service';

class GuestOrderActivationDto {
  @IsString() @MinLength(20) @MaxLength(256) public token!: string;
  @IsString() @MinLength(8) @MaxLength(128) public password!: string;
  @IsOptional() @IsString() @MaxLength(160) public fullName?: string;
}

@ApiTags('Guest account activation')
@Controller('auth')
export class GuestOrderActivationController {
  public constructor(private readonly activation: GuestOrderActivationService) {}

  @Post('guest-activation')
  @HttpCode(200)
  public async activate(@Body() input: GuestOrderActivationDto) {
    try {
      const result = await this.activation.activate(input);
      return {
        status: 'authenticated',
        orderId: result.orderId,
        session: result.session,
      };
    } catch (error) {
      throw new UnauthorizedException(error instanceof Error ? error.message : 'El enlace de activación no es válido.');
    }
  }
}
