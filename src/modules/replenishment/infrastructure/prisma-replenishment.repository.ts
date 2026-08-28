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

type PlanRecord = Prisma.ReplenishmentPlanGetPayload<{
  include: { variant: { include: { product: true } } };
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
        include: { variant: { include: { product: true } } },
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
        nextReminderAt: new Date(
          input.estimatedDepletionDate.getTime() - 5 * 24 * 60 * 60 * 1000,
        ),
        channel: input.channel,
        reminderChannels: input.reminderChannels ?? [input.channel],
        idempotencyKey: input.idempotencyKey ?? null,
        consentAt: new Date(),
        consentVersion: input.consentVersion.trim(),
        status: 'ACTIVE',
      },
      include: { variant: { include: { product: true } } },
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
      include: { variant: { include: { product: true } } },
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
      include: { variant: { include: { product: true } } },
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
        include: { variant: { include: { product: true } } },
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
        include: { variant: { include: { product: true } } },
      }),
    );
  }

  public async recalibrate(
    id: string,
    owner: ReplenishmentOwner,
    days: number,
  ) {
    await this.find(id, owner);
    const estimatedDepletionDate = new Date();
    estimatedDepletionDate.setUTCDate(
      estimatedDepletionDate.getUTCDate() + days,
    );
    const nextReminderAt = new Date(estimatedDepletionDate);
    nextReminderAt.setUTCDate(nextReminderAt.getUTCDate() - 5);
    return mapPlan(
      await this.prisma.replenishmentPlan.update({
        where: { id },
        data: {
          estimatedDepletionDate,
          nextReminderAt,
          needsReview: false,
          reviewReason: null,
        },
        include: { variant: { include: { product: true } } },
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
  createdAt: value.createdAt,
});
