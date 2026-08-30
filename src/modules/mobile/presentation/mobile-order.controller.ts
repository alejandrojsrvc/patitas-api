import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CustomerService } from '../../customers/application/customer.service';
import { CheckoutNotFoundError } from '../../checkout/domain/checkout.error';
import { MobileOrdersQueryDto } from './mobile-commerce.dto';
import type { MobileOrderRepository } from '../domain/mobile-order.repository';
import { MOBILE_ORDER_REPOSITORY } from '../domain/mobile-order.repository';
import { Inject } from '@nestjs/common';
import { toMobileOrder, toMobileOrderPage } from './mobile-commerce.mapper';

@ApiTags('Mobile orders')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('mobile/me/orders')
export class MobileOrderController {
  public constructor(
    @Inject(MOBILE_ORDER_REPOSITORY)
    private readonly orders: MobileOrderRepository,
    private readonly customers: CustomerService,
  ) {}

  @Get()
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MobileOrdersQueryDto,
  ) {
    const customerId = await this.customerId(user);
    return toMobileOrderPage(
      await this.orders.list(customerId, {
        filter: query.status,
        cursor: query.cursor,
        limit: query.limit,
      }),
    );
  }

  @Get('pets/:petId/purchase-history')
  public async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('petId') petId: string,
  ) {
    const customerId = await this.customerId(user);
    return this.orders.purchaseHistory(customerId, petId);
  }

  @Get(':id')
  public async find(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    const order = await this.orders.find(await this.customerId(user), orderId);
    if (!order) throw new CheckoutNotFoundError('El pedido no existe.');
    return toMobileOrder(order);
  }

  private async customerId(user: AuthenticatedUser): Promise<string> {
    return (await this.customers.findByUserId(user.userId)).id;
  }
}
