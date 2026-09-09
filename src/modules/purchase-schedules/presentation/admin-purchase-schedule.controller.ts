import { Body, Controller, Get, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { PurchaseScheduleService } from '../application/purchase-schedule.service';
import { UpdatePurchaseScheduleConfigurationDto } from './purchase-schedule.dto';

@ApiTags('Admin purchase schedules')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/purchase-schedules')
export class AdminPurchaseScheduleController {
  public constructor(private readonly schedules: PurchaseScheduleService) {}

  @Get('configuration')
  public configuration() {
    return this.schedules.configuration();
  }

  @Patch('configuration')
  public update(@Body() input: UpdatePurchaseScheduleConfigurationDto) {
    return this.schedules.updateConfiguration(input);
  }
}
