import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PurchaseScheduleValidationError } from '../application/purchase-schedule.service';
import type { PurchaseScheduleRepository } from '../domain/purchase-schedule.repository';
import type { PurchaseScheduleConfiguration, PurchaseSchedule, PurchaseScheduleStatus } from '../domain/purchase-schedule.types';
import { PURCHASE_SCHEDULE_DISCOUNT_PERCENT, PURCHASE_SCHEDULE_LEAD_DAYS } from '../domain/purchase-schedule.types';

type ScheduleRecord = Prisma.PurchaseScheduleGetPayload<{
  include: { variant: true };
}>;

@Injectable()
export class PrismaPurchaseScheduleRepository implements PurchaseScheduleRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async configure(input: { customerId: string; checkoutSessionId: string; enabled: boolean; frequencyDays?: number }) {
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id: input.checkoutSessionId, customerId: input.customerId },
      include: {
        cart: { include: { items: true } },
        purchaseSchedule: true,
        coupon: { select: { id: true } },
      },
    });
    if (!session) throw new PurchaseScheduleValidationError('El checkout no existe o no tienes acceso.');
    if (!input.enabled) {
      if (!session.purchaseSchedule) return null;
      return mapSchedule(
        await this.prisma.purchaseSchedule.update({
          where: { id: session.purchaseSchedule.id },
          data: { status: 'CANCELLED' },
          include: { variant: true },
        }),
      );
    }
    if (session.coupon) throw new PurchaseScheduleValidationError('La compra programada no es acumulable con el cupón aplicado.');
    const configuration = await this.configuration();
    if (!configuration.enabled) throw new PurchaseScheduleValidationError('La compra programada no está disponible en este momento.');
    const item = session.cart.items.find((candidate) => candidate.role === 'MAIN') ?? session.cart.items[0];
    if (!item) throw new PurchaseScheduleValidationError('El checkout no tiene productos.');
    const scheduleData = {
      variantId: item.variantId,
      quantity: item.quantity,
      frequencyDays: input.frequencyDays!,
      status: 'DRAFT' as const,
      nextOrderAt: null,
      nextReminderAt: null,
    };
    const schedule = session.purchaseSchedule
      ? await this.prisma.purchaseSchedule.update({
          where: { id: session.purchaseSchedule.id },
          data: scheduleData,
          include: { variant: true },
        })
      : await this.prisma.purchaseSchedule.create({
          data: {
            customerId: input.customerId,
            checkoutSessionId: input.checkoutSessionId,
            ...scheduleData,
            discountPercent: configuration.discountPercent,
            leadDays: configuration.leadDays,
          },
          include: { variant: true },
        });
    return mapSchedule(schedule);
  }

  public async configuration(): Promise<PurchaseScheduleConfiguration> {
    const existing = await this.prisma.purchaseScheduleConfiguration.findUnique({
      where: { singletonKey: 'DEFAULT' },
    });
    if (existing) return mapConfiguration(existing);
    try {
      return mapConfiguration(
        await this.prisma.purchaseScheduleConfiguration.create({
          data: {
            singletonKey: 'DEFAULT',
            enabled: true,
            discountPercent: PURCHASE_SCHEDULE_DISCOUNT_PERCENT,
            leadDays: PURCHASE_SCHEDULE_LEAD_DAYS,
          },
        }),
      );
    } catch (error) {
      const concurrent = await this.prisma.purchaseScheduleConfiguration.findUnique({
        where: { singletonKey: 'DEFAULT' },
      });
      if (concurrent) return mapConfiguration(concurrent);
      throw error;
    }
  }

  public async updateConfiguration(input: {
    enabled?: boolean;
    discountPercent?: string;
    leadDays?: number;
  }): Promise<PurchaseScheduleConfiguration> {
    const existing = await this.configuration();
    return mapConfiguration(
      await this.prisma.purchaseScheduleConfiguration.update({
        where: { id: existing.id },
        data: {
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
          ...(input.leadDays !== undefined ? { leadDays: input.leadDays } : {}),
        },
      }),
    );
  }

  public async list(customerId: string) {
    const rows = await this.prisma.purchaseSchedule.findMany({
      where: { customerId },
      include: { variant: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapSchedule);
  }

  public async setStatus(id: string, customerId: string, status: PurchaseScheduleStatus) {
    const existing = await this.prisma.purchaseSchedule.findFirst({
      where: { id, customerId },
    });
    if (!existing) throw new PurchaseScheduleValidationError('La compra programada no existe o no tienes acceso.');
    return mapSchedule(
      await this.prisma.purchaseSchedule.update({
        where: { id },
        data: { status },
        include: { variant: true },
      }),
    );
  }

  public async prepareCheckout(id: string, customerId: string) {
    const schedule = await this.prisma.purchaseSchedule.findFirst({
      where: {
        id,
        customerId,
        status: { in: ['ACTIVE', 'AWAITING_CONFIRMATION'] },
      },
    });
    if (!schedule) throw new PurchaseScheduleValidationError('La compra programada no está disponible para confirmación.');
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: schedule.variantId,
        active: true,
        product: { status: 'ACTIVE' },
      },
      include: { inventory: true },
    });
    const available = (variant?.inventory?.onHand ?? 0) - (variant?.inventory?.reserved ?? 0);
    if (!variant || available < schedule.quantity)
      throw new PurchaseScheduleValidationError('La variante no tiene stock suficiente para preparar la reposición.');
    const cart = await this.prisma.cart.create({
      data: {
        customerId,
        source: 'STORE',
        items: {
          create: {
            variantId: schedule.variantId,
            quantity: schedule.quantity,
            role: 'MAIN',
          },
        },
      },
    });
    return { cartId: cart.id };
  }
}

const mapSchedule = (value: ScheduleRecord): PurchaseSchedule => ({
  id: value.id,
  customerId: value.customerId,
  checkoutSessionId: value.checkoutSessionId,
  initialOrderId: value.initialOrderId,
  orderLineId: value.orderLineId,
  variantId: value.variantId,
  quantity: value.quantity,
  frequencyDays: value.frequencyDays,
  discountPercent: value.discountPercent.toString(),
  leadDays: value.leadDays,
  status: value.status,
  nextOrderAt: value.nextOrderAt,
  nextReminderAt: value.nextReminderAt,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

const mapConfiguration = (
  value: Prisma.PurchaseScheduleConfigurationGetPayload<Prisma.PurchaseScheduleConfigurationDefaultArgs>,
): PurchaseScheduleConfiguration => ({
  id: value.id,
  enabled: value.enabled,
  discountPercent: value.discountPercent.toString(),
  leadDays: value.leadDays,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});
