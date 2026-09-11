import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CustomerService } from '../../customers/application/customer.service';
import { ShipmentService } from '../application/shipment.service';
import { ChangeOrderAddressDto, TransitionShipmentDto } from './shipment.dto';
import { CreateCustomerClaimDto, UpdateCustomerClaimDto } from './customer-claim.dto';
import { CustomerClaimService } from '../application/customer-claim.service';

@ApiTags('Shipments')
@ApiBearerAuth()
@Controller()
export class ShipmentController {
  public constructor(
    private readonly shipments: ShipmentService,
    private readonly customers: CustomerService,
    private readonly claims: CustomerClaimService,
  ) {}
  @Get('me/orders/:orderId/shipment')
  @UseGuards(AuthGuard)
  public async customer(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.shipments.getForCustomer(orderId, (await this.customers.findByUserId(user.userId)).id);
  }
  @Patch('me/orders/:orderId/address')
  @UseGuards(AuthGuard)
  public async changeAddress(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string, @Body() input: ChangeOrderAddressDto) {
    return this.shipments.changeAddress(orderId, (await this.customers.findByUserId(user.userId)).id, input.address);
  }
  @Get('me/orders/:orderId/claims')
  @UseGuards(AuthGuard)
  public async listClaims(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.claims.listForCustomer(orderId, (await this.customers.findByUserId(user.userId)).id);
  }
  @Post('me/orders/:orderId/claims')
  @UseGuards(AuthGuard)
  public async createClaim(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string, @Body() input: CreateCustomerClaimDto) {
    return this.claims.create(orderId, (await this.customers.findByUserId(user.userId)).id, input.type, input.message);
  }
  @Get('admin/orders/:orderId/shipment')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  public admin(@Param('orderId') orderId: string) {
    return this.shipments.getForAdmin(orderId);
  }
  @Post('admin/orders/:orderId/shipment')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  public transition(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string, @Body() input: TransitionShipmentDto) {
    return this.shipments.transition(orderId, input.status as never, user.userId, input);
  }
  @Patch('admin/claims/:id')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  public updateClaim(@Param('id') id: string, @Body() input: UpdateCustomerClaimDto) {
    return this.claims.update(id, input.status, input.resolution);
  }
}
