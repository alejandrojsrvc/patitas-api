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
  ShippingDeliveryWindowsDto,
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
  @Get('quote') public quote(
    @Query('postalCode') postalCode?: string,
    @Query('neighborhood') neighborhood?: string,
    @Query('city') city?: string,
    @Query('province') province?: string,
    @Query('subtotal') subtotal = '0',
    @Query('weightGrams') weight?: string,
  ) {
    return this.shipping.quote({
      postalCode,
      neighborhood,
      city,
      province,
      subtotal,
      weightGrams: weight ? Number(weight) : undefined,
    });
  }
  @Get('zones') public zones(@Query('active') active?: string) {
    return this.shipping.listZones(active === 'true');
  }
  @Patch('zones/:id/delivery-windows') public updateDeliveryWindows(
    @Param('id') id: string,
    @Body() input: ShippingDeliveryWindowsDto,
  ) {
    return this.shipping.updateZone(id, { deliveryWindows: input });
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
