import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { ShippingService } from '../application/shipping.service';
import {
  CreateShippingOptionDto,
  CreateShippingZoneDto,
  UpdateShippingOptionDto,
  UpdateShippingZoneDto,
} from './shipping.dto';
import { ShippingExceptionFilter } from './shipping.exception.filter';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';

@ApiTags('Shipping')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseFilters(ShippingExceptionFilter)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/shipping-options')
export class ShippingController {
  public constructor(private readonly shipping: ShippingService) {}
  @Get() public list(@Query('active') active?: string) {
    return this.shipping.list(active === 'true');
  }
  @Post() public create(@Body() input: CreateShippingOptionDto) {
    return this.shipping.create(input);
  }
  @Patch(':id') public update(
    @Param('id') id: string,
    @Body() input: UpdateShippingOptionDto,
  ) {
    return this.shipping.update(id, input);
  }
  @Get('zones') public zones(@Query('active') active?: string) {
    return this.shipping.listZones(active === 'true');
  }
  @Post('zones') public createZone(@Body() input: CreateShippingZoneDto) {
    return this.shipping.createZone(input);
  }
  @Patch('zones/:id') public updateZone(
    @Param('id') id: string,
    @Body() input: UpdateShippingZoneDto,
  ) {
    return this.shipping.updateZone(id, input);
  }
}
