import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  PAYMENT_PROVIDER_RESOLVER,
  type PaymentProvider,
  type PaymentProviderName,
  type PaymentProviderResolver,
} from '../../shared/application/ports/payment-provider.interface';
import { MercadoPagoPaymentAdapter } from './mercadopago-payment.adapter';
import { PaywayPaymentAdapter } from './payway-payment.adapter';
import { SimulatedPaymentAdapter } from './simulated-payment.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    MercadoPagoPaymentAdapter,
    PaywayPaymentAdapter,
    SimulatedPaymentAdapter,
    {
      provide: PAYMENT_PROVIDER_RESOLVER,
      inject: [
        MercadoPagoPaymentAdapter,
        PaywayPaymentAdapter,
        SimulatedPaymentAdapter,
      ],
      useFactory: (
        mercadoPago: MercadoPagoPaymentAdapter,
        payway: PaywayPaymentAdapter,
        simulated: SimulatedPaymentAdapter,
      ): PaymentProviderResolver => {
        const providers = new Map<PaymentProviderName, PaymentProvider>([
          ['mercadopago', mercadoPago],
          ['payway', payway],
          ['simulated', simulated],
        ]);
        return {
          resolve(provider) {
            const resolved = providers.get(provider);
            if (!resolved)
              throw new Error(`Proveedor de pago no soportado: ${provider}.`);
            return resolved;
          },
        };
      },
    },
  ],
  exports: [PAYMENT_PROVIDER_RESOLVER],
})
export class PaymentInfrastructureModule {}
