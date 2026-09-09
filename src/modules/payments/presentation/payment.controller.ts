import {
  Body,
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  Get,
  Query,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CustomerService } from '../../customers/application/customer.service';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { PaymentService } from '../application/payment.service';
import { InitiatePaywayPaymentDto, RefundPaymentDto } from './payment.dto';
import { ReportTransferDto } from './manual-transfer.dto';
import { PAYMENT_PROVIDER_RESOLVER, type PaymentProviderResolver } from '../../../shared/application/ports/payment-provider.interface';
import { PaymentProviderConfigurationService } from '../application/payment-provider-configuration.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  public constructor(
    private readonly payments: PaymentService,
    private readonly customers: CustomerService,
    @Inject(PAYMENT_PROVIDER_RESOLVER)
    private readonly providers: PaymentProviderResolver,
    private readonly configurations: PaymentProviderConfigurationService,
  ) {}

  @Get('methods') public methods() {
    return this.configurations.availableMethods();
  }

  @Post('orders/:id/link')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Token', required: false })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @UseGuards(OptionalAuthGuard)
  public async link(
    @Req() request: Request,
    @Param('id') orderId: string,
    @Headers('x-order-token') token?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payments.initiate(orderId, await paymentOwnerFromRequest(request, this.customers, token), undefined, idempotencyKey);
  }

  @Post('orders/:id/payway')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Token', required: false })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @UseGuards(OptionalAuthGuard)
  public async payway(
    @Req() request: Request,
    @Param('id') orderId: string,
    @Body() input: InitiatePaywayPaymentDto,
    @Headers('x-order-token') token?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.payments.assertMethodAvailable('PAYWAY');
    return this.payments.initiate(
      orderId,
      await paymentOwnerFromRequest(request, this.customers, token),
      {
        type: 'TOKENIZED_CARD',
        token: input.token,
        installments: input.installments,
        paymentMethodReference: input.paymentMethodId,
        cardBin: input.bin,
      },
      idempotencyKey,
    );
  }

  @Get('orders/:id/status')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Token', required: false })
  @UseGuards(OptionalAuthGuard)
  public async status(@Req() request: Request, @Param('id') orderId: string, @Headers('x-order-token') token?: string) {
    return this.payments.status(orderId, await paymentOwnerFromRequest(request, this.customers, token));
  }

  @Get('orders/:id/transfer')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Token', required: false })
  @UseGuards(OptionalAuthGuard)
  public async transfer(@Req() request: Request, @Param('id') orderId: string, @Headers('x-order-token') token?: string) {
    return this.payments.transferStatus(orderId, await paymentOwnerFromRequest(request, this.customers, token));
  }

  @Post('orders/:id/transfer/report')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Token', required: false })
  @UseGuards(OptionalAuthGuard)
  public async reportTransfer(
    @Req() request: Request,
    @Param('id') orderId: string,
    @Body() input: ReportTransferDto,
    @Headers('x-order-token') token?: string,
  ) {
    return this.payments.reportTransfer(orderId, await paymentOwnerFromRequest(request, this.customers, token), input?.reference);
  }

  @Post('orders/:id/transfer/proof/upload')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Token', required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(OptionalAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 } }))
  public async transferProof(
    @Req() request: Request,
    @Param('id') orderId: string,
    @UploadedFile()
    file:
      | {
          originalname: string;
          mimetype: string;
          buffer: Uint8Array;
        }
      | undefined,
    @Headers('x-order-token') token?: string,
  ) {
    if (!file) throw new BadRequestException('El comprobante es obligatorio.');
    return this.payments.uploadTransferProof(orderId, await paymentOwnerFromRequest(request, this.customers, token), {
      originalName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
    });
  }

  @Post('orders/:id/refund')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  public refund(@Param('id') orderId: string, @Body() input: RefundPaymentDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.payments.refund(orderId, { admin: true }, input.amount, idempotencyKey);
  }

  @Post('webhooks/mercadopago')
  public webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Query('data.id') dataId?: string,
  ) {
    return this.providers
      .resolve('mercadopago')
      .parseWebhook({ headers, body, rawBody: request.rawBody, dataId })
      .then((receipt) => this.payments.webhook({ provider: 'mercadopago', receipt }));
  }

  @Post('webhooks/payway')
  public paywayWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    return this.providers
      .resolve('payway')
      .parseWebhook({ headers, body, rawBody: request.rawBody })
      .then((receipt) => this.payments.webhook({ provider: 'payway', receipt }));
  }
}

const paymentOwnerFromRequest = async (request: Request, customers: CustomerService, token?: string) => {
  const userId = (request as Request & { user?: { userId: string } }).user?.userId;
  return {
    ...(userId ? { customerId: (await customers.findByUserId(userId)).id } : {}),
    ...(token ? { publicTokenHash: hashAnonymousToken(token) } : {}),
  };
};
