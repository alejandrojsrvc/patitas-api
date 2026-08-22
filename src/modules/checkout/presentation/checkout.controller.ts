import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { ShippingService } from '../../shipping/application/shipping.service';
import { CheckoutService } from '../application/checkout.service';
import { CheckoutExceptionFilter } from './checkout.exception.filter';
import { CheckoutValidationError } from '../domain/checkout.error';
import {
  ContactStepDto,
  CreateCheckoutSessionDto,
  CouponDto,
  PaymentMethodStepDto,
  ShippingAddressStepDto,
  ShippingOptionStepDto,
} from './checkout.dto';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';

@ApiTags('Customer checkout')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Cart-Token', required: false })
@ApiHeader({ name: 'X-Checkout-Token', required: false })
@UseGuards(OptionalAuthGuard)
@UseFilters(CheckoutExceptionFilter)
@Controller('checkout')
export class CheckoutController {
  public constructor(
    private readonly checkout: CheckoutService,
    private readonly customers: CustomerService,
    private readonly shipping: ShippingService,
  ) {}

  @Post('sessions') public async create(
    @Req() request: Request,
    @Body() input: CreateCheckoutSessionDto,
  ) {
    return this.checkout.create(
      input.cartId,
      await ownerFromRequest(request, this.customers, 'cart'),
    );
  }
  @Get('sessions/:id') public async get(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    return this.checkout.find(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
    );
  }
  @Patch('sessions/:id/contact') public async contact(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: ContactStepDto,
  ) {
    return this.checkout.setContact(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input,
    );
  }
  @Patch('sessions/:id/shipping-address') public async address(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: ShippingAddressStepDto,
  ) {
    return this.checkout.setAddress(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input.address,
    );
  }
  @Get('sessions/:id/shipping-options') public options(
    @Param('id') _id: string,
  ) {
    void _id;
    return this.shipping.list(true);
  }
  @Patch('sessions/:id/shipping-option') public async option(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: ShippingOptionStepDto,
  ) {
    return this.checkout.setShippingOption(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input.shippingOptionId,
    );
  }
  @Post('sessions/:id/coupon') public async coupon(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: CouponDto,
  ) {
    return this.checkout.applyCoupon(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input.code,
    );
  }
  @Delete('sessions/:id/coupon') public async clearCoupon(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    return this.checkout.clearCoupon(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
    );
  }
  @Patch('sessions/:id/payment-method') public async payment(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: PaymentMethodStepDto,
  ) {
    return this.checkout.setPaymentMethod(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input.paymentMethod,
    );
  }
  @Post('sessions/:id/confirm') public async confirm(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    return this.checkout.confirm(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
    );
  }
  @Get('orders/:id') public publicOrder(
    @Param('id') id: string,
    @Headers('x-order-token') token?: string,
  ) {
    if (!token) throw new CheckoutValidationError('Se requiere X-Order-Token.');
    return this.checkout.publicOrder(id, token);
  }
}

const ownerFromRequest = async (
  request: Request,
  customers: CustomerService,
  tokenType: 'cart' | 'checkout',
) => {
  const userId = (request as Request & { user?: { userId: string } }).user
    ?.userId;
  if (userId) return { customerId: (await customers.findByUserId(userId)).id };
  return ownerFromRequestSync(request, tokenType);
};
const ownerFromRequestSync = (
  request: Request,
  tokenType: 'cart' | 'checkout',
) => {
  const token =
    request.headers[tokenType === 'cart' ? 'x-cart-token' : 'x-checkout-token'];
  return typeof token === 'string'
    ? { tokenHash: hashAnonymousToken(token) }
    : {};
};
