import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ReplenishmentEstimateRepository } from '../domain/estimate.repository';
import type {
  CreateEstimateInput,
  ReplenishmentEstimate,
} from '../domain/estimate.types';

type EstimateRecord =
  Prisma.ReplenishmentEstimateGetPayload<Prisma.ReplenishmentEstimateDefaultArgs>;

@Injectable()
export class PrismaEstimateRepository implements ReplenishmentEstimateRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: {
    customerId: string;
    petId?: string | null;
    request: CreateEstimateInput;
    result: {
      dailyGrams: { min: number; max: number };
      durationDays: { min: number; max: number };
      source: string;
      sourceLabel: string;
      sourceUrl: string | null;
      estimatedDepletionDate: Date;
      assumptions: string[];
    };
  }) {
    const row = await this.prisma.replenishmentEstimate.create({
      data: {
        customerId: input.customerId,
        petId: input.petId ?? null,
        petName: input.request.pet.name.trim(),
        petSpecies: input.request.pet.species,
        petWeightKg: input.request.pet.weightKg,
        petLifeStage: input.request.pet.lifeStage,
        petBreed: input.request.pet.breed?.trim() || null,
        productId: input.request.food.productId ?? null,
        variantId: input.request.food.variantId ?? null,
        customBrand: input.request.food.custom?.brand.trim() ?? null,
        customName: input.request.food.custom?.name.trim() ?? null,
        customWeightGrams: input.request.food.custom?.weightGrams ?? null,
        dailyGramsMin: input.result.dailyGrams.min,
        dailyGramsMax: input.result.dailyGrams.max,
        durationDaysMin: input.result.durationDays.min,
        durationDaysMax: input.result.durationDays.max,
        source: input.result.source,
        sourceLabel: input.result.sourceLabel,
        sourceUrl: input.result.sourceUrl,
        estimatedDepletionDate: input.result.estimatedDepletionDate,
        assumptions: input.result.assumptions,
      },
    });
    return mapEstimate(row);
  }

  public async findOwned(id: string, customerId: string) {
    const row = await this.prisma.replenishmentEstimate.findFirst({
      where: { id, customerId },
    });
    return row ? mapEstimate(row) : null;
  }
}

const mapEstimate = (value: EstimateRecord): ReplenishmentEstimate => ({
  id: value.id,
  dailyGrams: {
    min: Number(value.dailyGramsMin),
    max: Number(value.dailyGramsMax),
  },
  durationDays: {
    min: Number(value.durationDaysMin),
    max: Number(value.durationDaysMax),
  },
  source: value.source,
  sourceLabel: value.sourceLabel,
  sourceUrl: value.sourceUrl,
  estimatedDepletionDate: value.estimatedDepletionDate,
  assumptions: Array.isArray(value.assumptions)
    ? (value.assumptions as string[])
    : [],
  productId: value.productId,
  variantId: value.variantId,
  custom:
    value.customBrand && value.customName && value.customWeightGrams
      ? {
          brand: value.customBrand,
          name: value.customName,
          weightGrams: value.customWeightGrams,
        }
      : null,
});
