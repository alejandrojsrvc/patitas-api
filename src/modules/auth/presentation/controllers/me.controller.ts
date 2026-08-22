import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../authenticated-user';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthGuard } from '../guards/auth.guard';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  @Get()
  public current(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
