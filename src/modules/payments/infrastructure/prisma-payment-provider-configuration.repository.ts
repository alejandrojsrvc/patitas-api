import { Injectable } from '@nestjs/common';
import type { PaymentProviderConfigurationName } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { PaymentProviderName } from '../../../shared/domain/payment.types';
import type {
  PaymentProviderConfiguration,
  PaymentProviderConfigurationRepository,
} from '../domain/payment-provider-configuration.repository';

const TO_PRISMA: Record<PaymentProviderName, PaymentProviderConfigurationName> =
  {
    simulated: 'SIMULATED',
    mercadopago: 'MERCADO_PAGO',
    payway: 'PAYWAY',
  };

const FROM_PRISMA: Record<
  PaymentProviderConfigurationName,
  PaymentProviderName
> = {
  SIMULATED: 'simulated',
  MERCADO_PAGO: 'mercadopago',
  PAYWAY: 'payway',
};

@Injectable()
export class PrismaPaymentProviderConfigurationRepository implements PaymentProviderConfigurationRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(): Promise<PaymentProviderConfiguration[]> {
    const rows = await this.prisma.paymentProviderConfiguration.findMany({
      orderBy: [{ priority: 'desc' }, { provider: 'asc' }],
    });
    return rows.map(mapConfiguration);
  }

  public async find(provider: PaymentProviderName) {
    const row = await this.prisma.paymentProviderConfiguration.findUnique({
      where: { provider: TO_PRISMA[provider] },
    });
    return row ? mapConfiguration(row) : null;
  }

  public async isEnabled(provider: PaymentProviderName) {
    const row = await this.prisma.paymentProviderConfiguration.findUnique({
      where: { provider: TO_PRISMA[provider] },
      select: { enabled: true },
    });
    return row?.enabled ?? false;
  }

  public async update(
    provider: PaymentProviderName,
    input: { enabled?: boolean; priority?: number },
  ) {
    const row = await this.prisma.paymentProviderConfiguration.update({
      where: { provider: TO_PRISMA[provider] },
      data: input,
    });
    return mapConfiguration(row);
  }
}

const mapConfiguration = (row: {
  id: string;
  provider: PaymentProviderConfigurationName;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}): PaymentProviderConfiguration => ({
  id: row.id,
  provider: FROM_PRISMA[row.provider],
  enabled: row.enabled,
  priority: row.priority,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
