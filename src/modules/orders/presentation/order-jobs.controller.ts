import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { OrderService } from '../application/order.service';

@ApiTags('Order jobs')
@Controller('jobs/orders')
export class OrderJobsController {
  public constructor(
    private readonly orders: OrderService,
    private readonly config: ConfigService,
  ) {}

  @Post('expire-payment-reservations')
  @HttpCode(200)
  @ApiHeader({ name: 'X-Cron-Secret', required: true })
  public expireReservations(@Headers('x-cron-secret') received?: string) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!safeSecret(received, expected)) throw new UnauthorizedException();
    return this.orders.expirePaymentReservations();
  }
}

const safeSecret = (received?: string, expected?: string): boolean => {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
};
