import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  PaymentMethodBenefitConfiguration,
  PaymentMethodBenefitRepository,
  TransferInstructions,
} from '../domain/payment-method-benefit.repository';

const PAYMENT_METHOD = 'BANK_TRANSFER';

@Injectable()
export class PrismaPaymentMethodBenefitRepository implements PaymentMethodBenefitRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async transfer(): Promise<PaymentMethodBenefitConfiguration> {
    const existing = await this.prisma.paymentMethodBenefitConfiguration.findUnique({
      where: { paymentMethod: PAYMENT_METHOD },
    });
    if (existing) return mapConfiguration(existing);
    try {
      return mapConfiguration(
        await this.prisma.paymentMethodBenefitConfiguration.create({
          data: {
            paymentMethod: PAYMENT_METHOD,
            enabled: false,
            discountPercent: 0,
            expirationMinutes: 120,
          },
        }),
      );
    } catch (error) {
      const concurrent = await this.prisma.paymentMethodBenefitConfiguration.findUnique({
        where: { paymentMethod: PAYMENT_METHOD },
      });
      if (concurrent) return mapConfiguration(concurrent);
      throw error;
    }
  }

  public async updateTransfer(input: {
    enabled?: boolean;
    discountPercent?: string;
    expirationMinutes?: number;
    instructions?: TransferInstructions | null;
  }): Promise<PaymentMethodBenefitConfiguration> {
    const existing = await this.transfer();
    return mapConfiguration(
      await this.prisma.paymentMethodBenefitConfiguration.update({
        where: { id: existing.id },
        data: {
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
          ...(input.expirationMinutes !== undefined ? { expirationMinutes: input.expirationMinutes } : {}),
          ...(input.instructions !== undefined
            ? {
                instructions: input.instructions === null ? Prisma.JsonNull : (input.instructions as unknown as Prisma.InputJsonValue),
              }
            : {}),
        },
      }),
    );
  }
}

const mapConfiguration = (
  value: Prisma.PaymentMethodBenefitConfigurationGetPayload<Prisma.PaymentMethodBenefitConfigurationDefaultArgs>,
): PaymentMethodBenefitConfiguration => ({
  id: value.id,
  paymentMethod: value.paymentMethod,
  enabled: value.enabled,
  discountPercent: value.discountPercent.toString(),
  expirationMinutes: value.expirationMinutes,
  instructions: parseInstructions(value.instructions),
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

const parseInstructions = (value: Prisma.JsonValue | null): TransferInstructions | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.accountHolder !== 'string' || typeof record.bank !== 'string') return null;
  return {
    accountHolder: record.accountHolder,
    bank: record.bank,
    alias: typeof record.alias === 'string' ? record.alias : null,
    cbu: typeof record.cbu === 'string' ? record.cbu : null,
    note: typeof record.note === 'string' ? record.note : null,
  };
};
