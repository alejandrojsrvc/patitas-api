import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { OrderService } from '../application/order.service';
import {
  CreateOrderDto,
  OrdersQueryDto,
  RegisterPaymentDto,
  TransitionOrderDto,
  UpdateOrderDto,
} from './order.dto';
import { OrderExceptionFilter } from './order.exception.filter';

@ApiTags('Admin orders')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(OrderExceptionFilter)
@Controller('admin/orders')
export class AdminOrderController {
  public constructor(private readonly orders: OrderService) {}

  @Get() public list(@Query() query: OrdersQueryDto) {
    return this.orders.list(query);
  }
  @Get(':id') public find(@Param('id') id: string) {
    return this.orders.find(id);
  }
  @Post() public create(@Body() input: CreateOrderDto) {
    return this.orders.create(input);
  }
  @Patch(':id') public update(
    @Param('id') id: string,
    @Body() input: UpdateOrderDto,
  ) {
    return this.orders.update(id, input);
  }
  @Post(':id/payment') public payment(
    @Param('id') id: string,
    @Body() input: RegisterPaymentDto,
  ) {
    return this.orders.registerPayment(id, {
      ...input,
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
    });
  }
  @Post(':id/status') public status(
    @Param('id') id: string,
    @Body() input: TransitionOrderDto,
  ) {
    return this.orders.transition(id, input.status);
  }
  @Post(':id/cancel') public cancel(@Param('id') id: string) {
    return this.orders.transition(id, 'CANCELLED');
  }
  @Post('expire-payment-reservations') public expireReservations() {
    return this.orders.expirePaymentReservations();
  }
  @Post(':orderId/payments/:paymentId/proof/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  public proof(
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @UploadedFile()
    file:
      | { originalname: string; mimetype: string; buffer: Uint8Array }
      | undefined,
  ) {
    if (!file)
      throw new BadRequestException('Se requiere un archivo de comprobante.');
    return this.orders.uploadPaymentProof(orderId, {
      paymentId,
      originalName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
    });
  }
}
