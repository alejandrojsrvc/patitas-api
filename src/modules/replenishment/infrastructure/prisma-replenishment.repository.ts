import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  createAnonymousToken,
  hashAnonymousToken,
} from '../../../shared/application/anonymous-token';
import { ReplenishmentValidationError } from '../application/replenishment.service';
import type {
  CreateReplenishmentPlanInput,
  ReplenishmentOwner,
  ReplenishmentPlan,
  ReplenishmentPlanStatus,
} from '../domain/replenishment.types';
import type { ReplenishmentRepository } from '../domain/replenishment.repository';

const planInclude = {
  variant: { include: { product: true } },
  order: {
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      total: true,
      createdAt: true,
    },
  },
} as const;

type PlanRecord = Prisma.ReplenishmentPlanGetPayload<{
  include: typeof planInclude;
}>;

@Injectable()
export class PrismaReplenishmentRepository implements ReplenishmentRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(
    input: CreateReplenishmentPlanInput,
    owner: ReplenishmentOwner,
  ) {
    if (input.idempotencyKey) {
      const existing = await this.prisma.replenishmentPlan.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: planInclude,
      });
      if (existing && existing.customerId === owner.customerId)
        return mapPlan(existing);
    }
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId, active: true },
      include: { product: true },
    });
    if (!variant || variant.product.status !== 'ACTIVE')
      throw new ReplenishmentValidationError(
        'El producto o la variante no se puede vender.',
      );
    const plan = await this.prisma.replenishmentPlan.create({
      data: {
        customerId: owner.customerId ?? null,
        orderId: input.orderId ?? null,
        petId: input.petId ?? null,
        estimateId: input.estimateId ?? null,
        guestAccessTokenHash:
          owner.guestTokenHash ?? input.guestAccessTokenHash ?? null,
        petName: input.petName.trim(),
        petSpecies: input.petSpecies.trim(),
        petWeightKg: input.petWeightKg,
        petLifeStage: input.petLifeStage.trim(),
        petBreed: input.petBreed?.trim() || null,
        productId: input.productId,
        variantId: input.variantId,
        skuSnapshot: variant.sku,
        presentationSnapshot: variant.presentation,
        dailyConsumption: input.dailyConsumption,
        dailyGramsMin: input.dailyGramsMin ?? null,
        dailyGramsMax: input.dailyGramsMax ?? null,
        consumptionUnit: input.consumptionUnit.trim(),
        durationDaysMin: input.durationDaysMin,
        durationDaysMax: input.durationDaysMax,
        calculationSource: input.calculationSource.trim(),
        estimatedDepletionDate: input.estimatedDepletionDate,
        bagStartedAt: input.bagStartedAt ?? null,
        remainingBucket: input.remainingBucket ?? null,
        channel: input.channel,
        reminderChannels: input.reminderChannels ?? [input.channel],
        idempotencyKey: input.idempotencyKey ?? null,
        consentAt: new Date(),
        consentVersion: input.consentVersion.trim(),
        status: 'ACTIVE',
        remindersEnabled: input.remindersEnabled ?? true,
        leadDays: input.leadDays ?? 5,
        nextReminderAt:
          input.remindersEnabled === false
            ? null
            : new Date(
                input.estimatedDepletionDate.getTime() -
                  (input.leadDays ?? 5) * 24 * 60 * 60 * 1000,
              ),
      },
      include: planInclude,
    });
    await this.prisma.communicationConsent.create({
      data: {
        customerId: owner.customerId ?? null,
        guestTokenHash:
          owner.guestTokenHash ?? input.guestAccessTokenHash ?? null,
        channel: input.channel,
        destination: input.destination.trim(),
        consentAt: new Date(),
        version: input.consentVersion.trim(),
      },
    });
    return mapPlan(plan);
  }

  public async list(owner: ReplenishmentOwner) {
    if (!owner.customerId && !owner.guestTokenHash)
      throw new ReplenishmentValidationError(
        'Se requiere autenticación o X-Order-Token.',
      );
    const rows = await this.prisma.replenishmentPlan.findMany({
      where: owner.customerId
        ? { customerId: owner.customerId }
        : { guestAccessTokenHash: owner.guestTokenHash },
      include: planInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapPlan);
  }
  public async find(id: string, owner: ReplenishmentOwner) {
    if (!owner.customerId && !owner.guestTokenHash)
      throw new ReplenishmentValidationError(
        'Se requiere autenticación o X-Order-Token.',
      );
    const row = await this.prisma.replenishmentPlan.findFirst({
      where: {
        id,
        ...(owner.customerId
          ? { customerId: owner.customerId }
          : { guestAccessTokenHash: owner.guestTokenHash }),
      },
      include: planInclude,
    });
    if (!row)
      throw new ReplenishmentValidationError(
        'El plan no existe o no tienes acceso.',
      );
    return mapPlan(row);
  }
  public async setStatus(
    id: string,
    owner: ReplenishmentOwner,
    status: ReplenishmentPlanStatus,
  ) {
    await this.find(id, owner);
    return mapPlan(
      await this.prisma.replenishmentPlan.update({
        where: { id },
        data: {
          status,
          ...(status === 'CANCELLED' ? { unsubscribedAt: new Date() } : {}),
        },
        include: planInclude,
      }),
    );
  }

  public async updateSchedule(
    id: string,
    owner: ReplenishmentOwner,
    nextReminderAt: Date,
  ) {
    await this.find(id, owner);
    return mapPlan(
      await this.prisma.replenishmentPlan.update({
        where: { id },
        data: { nextReminderAt },
        include: planInclude,
      }),
    );
  }

  public async recalibrate(
    id: string,
    owner: ReplenishmentOwner,
    days: number,
    remainingBucket?: string,
    observedAt?: Date,
  ) {
    await this.find(id, owner);
    const estimatedDepletionDate = new Date(observedAt ?? new Date());
    estimatedDepletionDate.setUTCDate(
      estimatedDepletionDate.getUTCDate() + days,
    );
    const current = await this.find(id, owner);
    const nextReminderAt = new Date(estimatedDepletionDate);
    nextReminderAt.setUTCDate(nextReminderAt.getUTCDate() - current.leadDays);
    return mapPlan(
      await this.prisma.replenishmentPlan.update({
        where: { id },
        data: {
          estimatedDepletionDate,
          remainingBucket: remainingBucket ?? current.remainingBucket,
          nextReminderAt: current.remindersEnabled ? nextReminderAt : null,
          newBagPending: false,
          needsReview: false,
          reviewReason: null,
        },
        include: planInclude,
      }),
    );
  }

  public async updateMobileState(
    id: string,
    owner: ReplenishmentOwner,
    input: {
      status?: ReplenishmentPlanStatus;
      nextReminderAt?: Date | null;
      remindersEnabled?: boolean;
      leadDays?: number;
    },
  ) {
    const current = await this.find(id, owner);
    const remindersEnabled = input.remindersEnabled ?? current.remindersEnabled;
    const leadDays = input.leadDays ?? current.leadDays;
    const hasScheduleChange =
      input.nextReminderAt !== undefined ||
      input.remindersEnabled !== undefined ||
      input.leadDays !== undefined;
    const nextReminderAt = !hasScheduleChange
      ? current.nextReminderAt
      : !remindersEnabled
        ? null
        : input.nextReminderAt !== undefined
          ? input.nextReminderAt
          : addDays(current.estimatedDepletionDate, -leadDays);
    return mapPlan(
      await this.prisma.replenishmentPlan.update({
        where: { id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          remindersEnabled,
          leadDays,
          nextReminderAt,
        },
        include: planInclude,
      }),
    );
  }

  public async changeProduct(
    id: string,
    owner: ReplenishmentOwner,
    productId: string,
    variantId: string,
    input: { bagStartedAt?: Date; remainingBucket?: string } = {},
  ) {
    await this.find(id, owner);
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, active: true },
      include: { product: true },
    });
    if (!variant || variant.product.status !== 'ACTIVE')
      throw new ReplenishmentValidationError(
        'El producto o la variante no se puede vender.',
      );
    const bagStartedAt = input.bagStartedAt ?? null;
    const estimatedDepletionDate = bagStartedAt
      ? addDays(bagStartedAt, (await this.find(id, owner)).durationDaysMax)
      : undefined;
    return mapPlan(
      await this.prisma.replenishmentPlan.update({
        where: { id },
        data: {
          productId,
          variantId,
          skuSnapshot: variant.sku,
          presentationSnapshot: variant.presentation,
          newBagPending: !bagStartedAt,
          bagStartedAt,
          remainingBucket: input.remainingBucket ?? null,
          ...(estimatedDepletionDate ? { estimatedDepletionDate } : {}),
        },
        include: planInclude,
      }),
    );
  }

  public async startBag(
    id: string,
    owner: ReplenishmentOwner,
    input: { orderId?: string; orderLineId?: string; startedAt?: Date } = {},
  ) {
    const current = await this.find(id, owner);
    if (input.orderId && current.orderId !== input.orderId)
      throw new ReplenishmentValidationError(
        'El pedido no corresponde al plan de reposición.',
      );
    if (input.orderLineId) {
      const line = await this.prisma.orderLine.findFirst({
        where: {
          id: input.orderLineId,
          orderId: input.orderId ?? current.orderId ?? undefined,
          planId: id,
        },
        select: { id: true },
      });
      if (!line)
        throw new ReplenishmentValidationError(
          'La línea del pedido no corresponde al plan.',
        );
    }
    const bagStartedAt = input.startedAt ?? new Date();
    const estimatedDepletionDate = addDays(
      bagStartedAt,
      current.durationDaysMax,
    );
    return mapPlan(
      await this.prisma.replenishmentPlan.update({
        where: { id },
        data: {
          bagStartedAt,
          estimatedDepletionDate,
          remainingBucket: null,
          newBagPending: false,
          nextReminderAt: current.remindersEnabled
            ? addDays(estimatedDepletionDate, -current.leadDays)
            : null,
        },
        include: planInclude,
      }),
    );
  }

  public async createReorderCart(
    id: string,
    owner: ReplenishmentOwner,
    options: { anonymousToken?: boolean } = {},
  ) {
    const plan = await this.prisma.replenishmentPlan.findFirst({
      where: {
        id,
        status: { in: ['ACTIVE', 'PAUSED'] },
        ...(owner.customerId
          ? { customerId: owner.customerId }
          : { guestAccessTokenHash: owner.guestTokenHash }),
      },
      include: { variant: { include: { product: true, inventory: true } } },
    });
    if (!plan)
      throw new ReplenishmentValidationError(
        'El plan no existe, está cancelado o no tienes acceso.',
      );
    const available =
      (plan.variant.inventory?.onHand ?? 0) -
      (plan.variant.inventory?.reserved ?? 0);
    if (!plan.variant.active || plan.variant.product.status !== 'ACTIVE')
      throw new ReplenishmentValidationError(
        'La variante ya no está disponible.',
      );
    if (available < 1)
      throw new ReplenishmentValidationError(
        'La variante está agotada; revisa el catálogo para elegir una alternativa.',
      );
    const token =
      owner.customerId && !options.anonymousToken
        ? null
        : createAnonymousToken();
    const cart = await this.prisma.cart.create({
      data: {
        customerId: owner.customerId ?? null,
        anonymousTokenHash: token ? hashAnonymousToken(token) : null,
        sourcePlanId: plan.id,
        currency: 'ARS',
        items: { create: { variantId: plan.variantId, quantity: 1 } },
      },
      include: { items: true },
    });
    return { cartId: cart.id, cartToken: token, status: 'ACTIVE' };
  }
}

const mapPlan = (value: PlanRecord): ReplenishmentPlan => ({
  id: value.id,
  customerId: value.customerId,
  orderId: value.orderId,
  petId: value.petId,
  estimateId: value.estimateId,
  petName: value.petName,
  petSpecies: value.petSpecies,
  petWeightKg: value.petWeightKg.toString(),
  petLifeStage: value.petLifeStage,
  petBreed: value.petBreed,
  productId: value.productId,
  variantId: value.variantId,
  weightGrams: value.variant?.weightGrams ?? null,
  productName: value.variant?.product?.name ?? null,
  salePrice: value.variant?.salePrice?.toString() ?? null,
  sku: value.skuSnapshot ?? value.variant?.sku ?? null,
  presentation:
    value.presentationSnapshot ?? value.variant?.presentation ?? null,
  dailyConsumption: value.dailyConsumption.toString(),
  dailyGramsMin: value.dailyGramsMin ? Number(value.dailyGramsMin) : null,
  dailyGramsMax: value.dailyGramsMax ? Number(value.dailyGramsMax) : null,
  consumptionUnit: value.consumptionUnit,
  durationDaysMin: value.durationDaysMin,
  durationDaysMax: value.durationDaysMax,
  calculationSource: value.calculationSource,
  estimatedDepletionDate: value.estimatedDepletionDate,
  nextReminderAt: value.nextReminderAt,
  channel: value.channel,
  reminderChannels: value.reminderChannels,
  status: value.status,
  needsReview: value.needsReview,
  reviewReason: value.reviewReason,
  bagStartedAt: value.bagStartedAt,
  remainingBucket: value.remainingBucket,
  remindersEnabled: value.remindersEnabled,
  leadDays: value.leadDays,
  newBagPending: value.newBagPending,
  activeOrder: value.order
    ? {
        id: value.order.id,
        number: value.order.number,
        status: value.order.status,
        paymentStatus: value.order.paymentStatus,
        total: value.order.total.toString(),
        createdAt: value.order.createdAt,
      }
    : null,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};
