import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';
import { PaymentProviderConfigurationService } from '../application/payment-provider-configuration.service';
import { UpdatePaymentProviderConfigurationDto } from './payment-provider-configuration.dto';

@ApiTags('Admin payment providers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/payment-providers')
export class AdminPaymentProviderController {
  public constructor(
    private readonly configurations: PaymentProviderConfigurationService,
  ) {}

  @Get() public list() {
    return this.configurations.list();
  }

  @Patch(':provider') public update(
    @Param('provider') provider: string,
    @Body() input: UpdatePaymentProviderConfigurationDto,
  ) {
    return this.configurations.update(provider, input);
  }
}
