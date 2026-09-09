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

@Module({
  imports: [ConfigModule],
  providers: [
    MercadoPagoPaymentAdapter,
    PaywayPaymentAdapter,
    {
      provide: PAYMENT_PROVIDER_RESOLVER,
      inject: [MercadoPagoPaymentAdapter, PaywayPaymentAdapter],
      useFactory: (mercadoPago: MercadoPagoPaymentAdapter, payway: PaywayPaymentAdapter): PaymentProviderResolver => {
        const providers = new Map<PaymentProviderName, PaymentProvider>([
          ['mercadopago', mercadoPago],
          ['payway', payway],
        ]);
        return {
          resolve(provider) {
            const resolved = providers.get(provider);
            if (!resolved) throw new Error(`Proveedor de pago no soportado: ${provider}.`);
            return resolved;
          },
        };
      },
    },
  ],
  exports: [PAYMENT_PROVIDER_RESOLVER],
})
export class PaymentInfrastructureModule {}
