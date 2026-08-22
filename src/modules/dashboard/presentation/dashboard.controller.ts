import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { DashboardService } from '../application/dashboard.service';

@ApiTags('Admin dashboard')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/dashboard')
export class DashboardController {
  public constructor(private readonly dashboard: DashboardService) {}
  @Get('summary')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        activeProducts: { type: 'integer' },
        variantsWithoutPrice: { type: 'integer' },
        pendingPricingReviews: { type: 'integer' },
        variantsWithoutSupplier: { type: 'integer' },
        averageMarginPercent: { type: 'number', nullable: true },
        alerts: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  public summary() {
    return this.dashboard.summary();
  }
}
