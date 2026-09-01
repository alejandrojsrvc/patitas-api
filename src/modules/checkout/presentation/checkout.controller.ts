import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CheckoutService } from '../application/checkout.service';
import { CheckoutBootstrapService } from '../application/checkout-bootstrap.service';
import { CheckoutExceptionFilter } from './checkout.exception.filter';
import { CheckoutValidationError } from '../domain/checkout.error';
import {
  ContactStepDto,
  ConfirmCheckoutDto,
  CheckoutMutationResponseDto,
  CheckoutConflictResponseDto,
  CheckoutScreenResponseDto,
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
    private readonly bootstrap: CheckoutBootstrapService,
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
  @Get('sessions/:id/bootstrap')
  @ApiOkResponse({ type: CheckoutScreenResponseDto })
  @Header('Cache-Control', 'private, no-store')
  public async getBootstrap(@Req() request: Request, @Param('id') id: string) {
    return this.bootstrap.get({
      id,
      owner: await ownerFromRequest(request, this.customers, 'checkout'),
      user: (request as Request & { user?: AuthenticatedUser }).user,
    });
  }
  @ApiOkResponse({ type: CheckoutMutationResponseDto })
  @ApiConflictResponse({ type: CheckoutConflictResponseDto })
  @Patch('sessions/:id/contact')
  public async contact(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: ContactStepDto,
  ) {
    return this.checkout.setContactWithState(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input,
    );
  }
  @ApiOkResponse({ type: CheckoutMutationResponseDto })
  @ApiConflictResponse({ type: CheckoutConflictResponseDto })
  @Patch('sessions/:id/shipping-address')
  public async address(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: ShippingAddressStepDto,
  ) {
    return this.checkout.setAddressWithState(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      normalizeCheckoutAddress(input.address),
    );
  }
  @Get('sessions/:id/shipping-options') public options(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    return ownerFromRequest(request, this.customers, 'checkout')
      .then((owner) => this.checkout.shippingOptions(id, owner))
      .then((options) =>
        options
          .filter((option) => option.available)
          .map(({ id, cost, deliverySlots }) => ({
            id,
            cost,
            deliverySlots,
          })),
      );
  }
  @Patch('sessions/:id/shipping-option')
  @ApiOkResponse({ type: CheckoutMutationResponseDto })
  @ApiConflictResponse({ type: CheckoutConflictResponseDto })
  public async option(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: ShippingOptionStepDto,
  ) {
    return this.checkout.setShippingOptionWithState(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input.shippingOptionId,
      input.deliverySlotId,
    );
  }
  @ApiOkResponse({ type: CheckoutMutationResponseDto })
  @ApiConflictResponse({ type: CheckoutConflictResponseDto })
  @Post('sessions/:id/coupon')
  public async coupon(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: CouponDto,
  ) {
    return this.checkout.applyCouponWithState(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input.code,
    );
  }
  @ApiOkResponse({ type: CheckoutMutationResponseDto })
  @ApiConflictResponse({ type: CheckoutConflictResponseDto })
  @Delete('sessions/:id/coupon')
  public async clearCoupon(@Req() request: Request, @Param('id') id: string) {
    return this.checkout.clearCouponWithState(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
    );
  }
  @ApiOkResponse({ type: CheckoutMutationResponseDto })
  @ApiConflictResponse({ type: CheckoutConflictResponseDto })
  @Patch('sessions/:id/payment-method')
  public async payment(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: PaymentMethodStepDto,
  ) {
    return this.checkout.setPaymentMethodWithState(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input.paymentMethod,
    );
  }
  @Post('sessions/:id/confirm')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public async confirm(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: ConfirmCheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.checkout.confirm(
      id,
      await ownerFromRequest(request, this.customers, 'checkout'),
      input?.payment
        ? {
            type: 'TOKENIZED_CARD',
            token: input.payment.token,
            installments: input.payment.installments,
            paymentMethodReference: input.payment.paymentMethodId,
            cardBin: input.payment.bin,
          }
        : undefined,
      idempotencyKey,
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

const normalizeCheckoutAddress = (
  address: Record<string, string | undefined>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(address).map(([key, value]) => [key, value ?? '']),
  );

const ownerFromRequest = async (
  request: Request,
  customers: CustomerService,
  tokenType: 'cart' | 'checkout',
) => {
  const userId = (request as Request & { user?: { userId: string } }).user
    ?.userId;
  const tokenOwner = ownerFromRequestSync(request, tokenType);
  if (userId)
    return {
      customerId: (await customers.findByUserId(userId)).id,
      ...tokenOwner,
    };
  return tokenOwner;
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
