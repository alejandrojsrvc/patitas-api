import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { PurchaseScheduleService } from '../application/purchase-schedule.service';
import { ConfigurePurchaseScheduleDto, UpdatePurchaseScheduleStatusDto } from './purchase-schedule.dto';

@ApiTags('Purchase schedules')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class PurchaseScheduleController {
  public constructor(
    private readonly schedules: PurchaseScheduleService,
    private readonly customers: CustomerService,
  ) {}

  @Post('checkout/sessions/:id/purchase-schedule')
  public async configure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') checkoutSessionId: string,
    @Body() input: ConfigurePurchaseScheduleDto,
  ) {
    return this.schedules.configure({
      customerId: await this.customerId(user),
      checkoutSessionId,
      enabled: input.enabled,
      frequencyDays: input.frequencyDays,
    });
  }

  @Post('mobile/checkout/sessions/:id/purchase-schedule')
  public configureMobile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') checkoutSessionId: string,
    @Body() input: ConfigurePurchaseScheduleDto,
  ) {
    return this.configure(user, checkoutSessionId, input);
  }

  @Get('me/purchase-schedules')
  public async list(@CurrentUser() user: AuthenticatedUser) {
    return this.schedules.list(await this.customerId(user));
  }

  @Get('mobile/me/purchase-schedules')
  public listMobile(@CurrentUser() user: AuthenticatedUser) {
    return this.list(user);
  }

  @Patch('me/purchase-schedules/:id')
  public async status(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdatePurchaseScheduleStatusDto) {
    return this.schedules.setStatus(id, await this.customerId(user), input.status);
  }

  @Patch('mobile/me/purchase-schedules/:id')
  public statusMobile(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdatePurchaseScheduleStatusDto) {
    return this.status(user, id, input);
  }

  @Post('me/purchase-schedules/:id/prepare-checkout')
  public async prepare(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.schedules.prepareCheckout(id, await this.customerId(user));
  }

  @Post('mobile/me/purchase-schedules/:id/prepare-checkout')
  public prepareMobile(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.prepare(user, id);
  }

  private customerId(user: AuthenticatedUser) {
    return this.customers.findByUserId(user.userId).then((customer) => customer.id);
  }
}
