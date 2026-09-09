import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CartService } from '../application/cart.service';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';

@ApiTags('Admin carts')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/carts')
export class AdminCartController {
  public constructor(private readonly carts: CartService) {}

  @Get('abandoned') public abandoned(@Query('page') page = '1', @Query('perPage') perPage = '24') {
    return this.carts.listAbandoned(Math.max(1, Number(page)), Math.min(100, Math.max(1, Number(perPage))));
  }
}
