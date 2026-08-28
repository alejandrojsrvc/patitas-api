import { Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckoutHandoffService } from '../application/checkout-handoff.service';

@ApiTags('Checkout handoff')
@Controller('checkout/handoffs')
export class CheckoutHandoffController {
  public constructor(private readonly handoffs: CheckoutHandoffService) {}

  @Post(':token/consume')
  public consume(@Param('token') token: string) {
    return this.handoffs.consume(token);
  }
}
