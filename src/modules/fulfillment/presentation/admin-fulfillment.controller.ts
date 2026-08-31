import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { FulfillmentService } from '../application/fulfillment.service';
import { UpdateFulfillmentSettingsDto } from './fulfillment.dto';

@ApiTags('Admin fulfillment')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/fulfillment')
export class AdminFulfillmentController {
  public constructor(private readonly fulfillment: FulfillmentService) {}

  @Get('settings') public settings() {
    return this.fulfillment.getSettings();
  }

  @Patch('settings') public update(
    @Body() input: UpdateFulfillmentSettingsDto,
  ) {
    return this.fulfillment.updateSettings(input);
  }
}
