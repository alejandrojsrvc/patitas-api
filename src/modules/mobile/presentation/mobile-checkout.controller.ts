import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseFilters,
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
import { CheckoutExceptionFilter } from '../../checkout/presentation/checkout.exception.filter';
import { CheckoutService } from '../../checkout/application/checkout.service';
import { CheckoutNotFoundError } from '../../checkout/domain/checkout.error';
import { MobileCheckoutService } from '../application/mobile-checkout.service';
import type { MobileOrderRepository } from '../domain/mobile-order.repository';
import { MOBILE_ORDER_REPOSITORY } from '../domain/mobile-order.repository';
import {
  MobileCheckoutAddressDto,
  MobileCheckoutContactDto,
  MobileCheckoutCouponDto,
  MobileCheckoutPaymentMethodDto,
  MobileCheckoutShippingOptionDto,
  MobileConfirmCheckoutDto,
  MobileCreateCheckoutSessionDto,
} from './mobile-commerce.dto';
import {
  toMobileCheckout,
  toMobileOrder,
  toMobilePayment,
} from './mobile-commerce.mapper';
import { Inject } from '@nestjs/common';

@ApiTags('Mobile checkout')
@ApiBearerAuth()
@ApiHeader({ name: 'Idempotency-Key', required: false })
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@UseFilters(CheckoutExceptionFilter)
@Controller('mobile/checkout')
export class MobileCheckoutController {
  public constructor(
    private readonly mobileCheckout: MobileCheckoutService,
    private readonly checkout: CheckoutService,
    private readonly customers: CustomerService,
    @Inject(MOBILE_ORDER_REPOSITORY)
    private readonly orders: MobileOrderRepository,
  ) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MobileCreateCheckoutSessionDto,
  ) {
    const customerId = await this.customerId(user);
    return {
      checkout: toMobileCheckout(
        (await this.mobileCheckout.create(customerId, input.cartId)).session,
      ),
    };
  }

  @Get('sessions/:id')
  public async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      checkout: toMobileCheckout(
        await this.mobileCheckout.find(await this.customerId(user), id),
      ),
    };
  }

  @Patch('sessions/:id/contact')
  public async contact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: MobileCheckoutContactDto,
  ) {
    return {
      checkout: toMobileCheckout(
        await this.mobileCheckout.contact(
          await this.customerId(user),
          id,
          input,
        ),
      ),
    };
  }

  @Patch('sessions/:id/shipping-address')
  public async address(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: MobileCheckoutAddressDto,
  ) {
    return {
      checkout: toMobileCheckout(
        await this.mobileCheckout.address(
          await this.customerId(user),
          id,
          input,
        ),
      ),
    };
  }

  @Get('sessions/:id/shipping-options')
  public async shippingOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const customerId = await this.customerId(user);
    const options = await this.checkout.shippingOptions(id, {
      customerId,
      source: 'MOBILE',
    });
    return { options: options.filter((option) => option.available) };
  }

  @Patch('sessions/:id/shipping-option')
  public async shippingOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: MobileCheckoutShippingOptionDto,
  ) {
    return {
      checkout: toMobileCheckout(
        await this.mobileCheckout.shippingOption(
          await this.customerId(user),
          id,
          input.shippingOptionId,
          input.deliverySlotId,
        ),
      ),
    };
  }

  @Patch('sessions/:id/payment-method')
  public async paymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: MobileCheckoutPaymentMethodDto,
  ) {
    return {
      checkout: toMobileCheckout(
        await this.mobileCheckout.paymentMethod(
          await this.customerId(user),
          id,
          input,
        ),
      ),
    };
  }

  @Post('sessions/:id/coupon')
  public async coupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: MobileCheckoutCouponDto,
  ) {
    return {
      checkout: toMobileCheckout(
        await this.mobileCheckout.coupon(
          await this.customerId(user),
          id,
          input.code,
        ),
      ),
    };
  }

  @Delete('sessions/:id/coupon')
  public async clearCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      checkout: toMobileCheckout(
        await this.mobileCheckout.clearCoupon(await this.customerId(user), id),
      ),
    };
  }

  @Post('sessions/:id/confirm')
  public async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: MobileConfirmCheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const customerId = await this.customerId(user);
    const result = await this.mobileCheckout.confirm(
      customerId,
      id,
      input.payment ? toTokenizedPayment(input.payment) : undefined,
      idempotencyKey,
    );
    const order = await this.orders.find(customerId, result.order.id);
    if (!order) throw new CheckoutNotFoundError('El pedido no existe.');
    return {
      order: toMobileOrder(order),
      payment: toMobilePayment(
        'payment' in result ? result.payment : null,
        order,
      ),
      checkout: toMobileCheckout(
        await this.mobileCheckout.find(customerId, id),
      ),
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
