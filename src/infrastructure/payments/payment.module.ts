import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../../shared/application/ports/payment-provider.interface';
import { MercadoPagoPaymentAdapter } from './mercadopago-payment.adapter';
import { SimulatedPaymentAdapter } from './simulated-payment.adapter';

@Module({
  imports: [ConfigModule],
  providers: [MercadoPagoPaymentAdapter, SimulatedPaymentAdapter, {
    provide: PAYMENT_PROVIDER,
    inject: [ConfigService, MercadoPagoPaymentAdapter, SimulatedPaymentAdapter],
    useFactory: (config: ConfigService, mercadoPago: MercadoPagoPaymentAdapter, simulated: SimulatedPaymentAdapter): PaymentProvider => config.get<string>('PAYMENT_PROVIDER', 'simulated') === 'mercadopago' ? mercadoPago : simulated,
  }],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentInfrastructureModule {}
