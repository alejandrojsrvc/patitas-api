import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { PaymentService } from '../application/payment.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  public constructor(
    private readonly payments: PaymentService,
    private readonly customers: CustomerService,
  ) {}

  @Post('orders/:id/link')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Token', required: false })
  @UseGuards(OptionalAuthGuard)
  public async link(
    @Req() request: Request,
    @Param('id') orderId: string,
    @Headers('x-order-token') token?: string,
  ) {
    const userId = (request as Request & { user?: { userId: string } }).user
      ?.userId;
    return this.payments.createLink(
      orderId,
      userId
        ? { customerId: (await this.customers.findByUserId(userId)).id }
        : { publicTokenHash: token ? hashAnonymousToken(token) : undefined },
    );
  }

  @Post('webhooks/mercadopago')
  public webhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    return this.payments.webhook({ headers, body });
  }
}
