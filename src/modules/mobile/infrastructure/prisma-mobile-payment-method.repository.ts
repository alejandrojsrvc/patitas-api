import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  CreateMobilePaymentMethodInput,
  MobilePaymentMethod,
  MobilePaymentMethodRepository,
} from '../domain/mobile-payment-method.repository';
import { MobilePaymentMethodError } from '../domain/mobile-payment-method.repository';

@Injectable()
export class PrismaMobilePaymentMethodRepository implements MobilePaymentMethodRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(customerId: string): Promise<MobilePaymentMethod[]> {
    const methods = await this.prisma.savedPaymentMethod.findMany({
      where: { customerId, active: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return methods.map(mapPaymentMethod);
  }

  public async create(
    customerId: string,
    input: CreateMobilePaymentMethodInput,
  ): Promise<MobilePaymentMethod> {
    return this.prisma.$transaction(async (transaction) => {
      if (input.isDefault)
        await transaction.savedPaymentMethod.updateMany({
          where: { customerId, active: true, isDefault: true },
          data: { isDefault: false },
        });
      const current = await transaction.savedPaymentMethod.count({
        where: { customerId, active: true },
      });
      const method = await transaction.savedPaymentMethod.create({
        data: {
          customerId,
          provider: input.provider,
          type: input.type,
          brand: input.brand ?? null,
          lastFour: input.lastFour ?? null,
          expirationMonth: input.expirationMonth ?? null,
          expirationYear: input.expirationYear ?? null,
          providerPaymentMethodId: input.providerPaymentMethodId,
          isDefault: input.isDefault ?? current === 0,
        },
      });
      return mapPaymentMethod(method);
    });
  }

  public async remove(id: string, customerId: string): Promise<void> {
    const result = await this.prisma.savedPaymentMethod.updateMany({
      where: { id, customerId, active: true },
      data: { active: false, isDefault: false },
    });
    if (result.count !== 1)
      throw new MobilePaymentMethodError(
        'El método de pago no existe o no tienes acceso.',
      );
  }

  public async findOwned(
    id: string,
    customerId: string,
  ): Promise<MobilePaymentMethod | null> {
    const method = await this.prisma.savedPaymentMethod.findFirst({
      where: { id, customerId, active: true },
    });
    return method ? mapPaymentMethod(method) : null;
  }
}

const mapPaymentMethod = (
  value: Prisma.SavedPaymentMethodGetPayload<Prisma.SavedPaymentMethodDefaultArgs>,
): MobilePaymentMethod => ({
  id: value.id,
  provider: value.provider as MobilePaymentMethod['provider'],
  type: value.type,
  brand: value.brand,
  lastFour: value.lastFour,
  expirationMonth: value.expirationMonth,
  expirationYear: value.expirationYear,
  isDefault: value.isDefault,
  active: value.active,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});
