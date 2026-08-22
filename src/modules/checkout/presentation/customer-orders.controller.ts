import { Controller, Get, Param, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { CheckoutService } from '../application/checkout.service';
import { CheckoutExceptionFilter } from './checkout.exception.filter';

@ApiTags('Customer orders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@UseFilters(CheckoutExceptionFilter)
@Controller('me/orders')
export class CustomerOrdersController {
  public constructor(
    private readonly checkout: CheckoutService,
    private readonly customers: CustomerService,
  ) {}
  @Get() public async list(@CurrentUser() user: AuthenticatedUser) {
    return this.checkout.customerOrders(
      (await this.customers.findByUserId(user.userId)).id,
    );
  }
  @Get(':id') public async find(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.checkout.customerOrder(
      (await this.customers.findByUserId(user.userId)).id,
      id,
    );
  }
}
