import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CustomerService } from '../../customers/application/customer.service';
import { PaymentProviderConfigurationService } from '../../payments/application/payment-provider-configuration.service';
import { CheckoutNotFoundError } from '../../checkout/domain/checkout.error';
import { MobilePaymentService } from '../application/mobile-payment.service';
import type { MobileOrderRepository } from '../domain/mobile-order.repository';
import { MOBILE_ORDER_REPOSITORY } from '../domain/mobile-order.repository';
import {
  MobileConfirmCheckoutDto,
  MobileSavedPaymentMethodDto,
} from './mobile-commerce.dto';
import { toMobileOrder, toMobilePayment } from './mobile-commerce.mapper';

@ApiTags('Mobile payments')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller()
export class MobilePaymentController {
  public constructor(
    private readonly payments: MobilePaymentService,
    private readonly customers: CustomerService,
    private readonly configurations: PaymentProviderConfigurationService,
    @Inject(MOBILE_ORDER_REPOSITORY)
    private readonly orders: MobileOrderRepository,
  ) {}

  @Get('mobile/payments/methods')
  public async methods(
    @CurrentUser() user: AuthenticatedUser,
    @Query('checkoutSessionId') checkoutSessionId?: string,
  ) {
    void checkoutSessionId;
    return this.payments.listMethods(
      await this.customerId(user),
      await this.configurations.availableMethods(),
    );
  }

  @Get('mobile/me/payment-methods')
  public async savedMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.listSavedMethods(await this.customerId(user));
  }

  @Post('mobile/me/payment-methods')
  public async saveMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MobileSavedPaymentMethodDto,
  ) {
    return this.payments.saveMethod(await this.customerId(user), input);
  }

  @Delete('mobile/me/payment-methods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async removeMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.payments.removeMethod(await this.customerId(user), id);
  }

  @Get('mobile/payments/orders/:id/status')
  public async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    const customerId = await this.customerId(user);
    const order = await this.orders.find(customerId, orderId);
    if (!order) throw new CheckoutNotFoundError('El pedido no existe.');
    const payment = ['PAID', 'UNPAID'].includes(order.paymentStatus)
      ? null
      : await this.payments.status(customerId, orderId);
    return {
      orderId,
      payment: toMobilePayment(payment, order),
      orderStatus: order.status,
    };
  }

  @Post('mobile/payments/orders/:id')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public async initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() input: MobileConfirmCheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const customerId = await this.customerId(user);
    const payment = await this.payments.initiate(
      customerId,
      orderId,
      input.payment ? toTokenizedPayment(input.payment) : undefined,
      idempotencyKey,
    );
    const order = await this.orders.find(customerId, orderId);
    return {
      order: order ? toMobileOrder(order) : null,
      payment: toMobilePayment(payment, order ?? undefined),
    };
  }

  private async customerId(user: AuthenticatedUser): Promise<string> {
    return (await this.customers.findByUserId(user.userId)).id;
  }
}

const toTokenizedPayment = (payment: MobileConfirmCheckoutDto['payment']) =>
  payment
    ? {
        type: 'TOKENIZED_CARD' as const,
        token: payment.token,
        installments: payment.installments,
        paymentMethodReference: payment.paymentMethodId,
        cardBin: payment.bin,
      }
    : undefined;
