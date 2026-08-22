import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  PromotionNotFoundError,
  PromotionValidationError,
} from '../domain/promotion.error';
import type { PromotionRepository } from '../domain/promotion.repository';
import type {
  Coupon,
  CouponInput,
  Promotion,
  PromotionInput,
} from '../domain/promotion.types';

const promotionInclude = { targets: true, bundleItems: true } as const;
const couponInclude = { promotion: { include: promotionInclude } } as const;
type PromotionRecord = Prisma.PromotionGetPayload<{
  include: typeof promotionInclude;
}>;
type CouponRecord = Prisma.CouponGetPayload<{ include: typeof couponInclude }>;

@Injectable()
export class PrismaPromotionRepository implements PromotionRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(activeOnly = false): Promise<Promotion[]> {
    const rows = await this.prisma.promotion.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: promotionInclude,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(mapPromotion);
  }
  public async findById(id: string) {
    const row = await this.prisma.promotion.findUnique({
      where: { id },
      include: promotionInclude,
    });
    return row ? mapPromotion(row) : null;
  }
  public async create(input: PromotionInput) {
    return this.prisma.$transaction(async (transaction) => {
      const row = await transaction.promotion.create({
        data: {
          ...promotionData(input),
          name: input.name,
          type: input.type,
          value: input.value,
          kind: input.kind ?? 'DISCOUNT',
          targets: { create: input.targets ?? [] },
          bundleItems: { create: input.bundleItems ?? [] },
        },
        include: promotionInclude,
      });
      return mapPromotion(row);
    });
  }
  public async update(id: string, input: Partial<PromotionInput>) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.promotion.findUnique({
        where: { id },
      });
      if (!existing) throw new PromotionNotFoundError();
      if (input.targets)
        await transaction.promotionTarget.deleteMany({
          where: { promotionId: id },
        });
      if (input.bundleItems)
        await transaction.promotionBundleItem.deleteMany({
          where: { promotionId: id },
        });
      const row = await transaction.promotion.update({
        where: { id },
        data: {
          ...promotionData(input),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.targets ? { targets: { create: input.targets } } : {}),
          ...(input.bundleItems
            ? { bundleItems: { create: input.bundleItems } }
            : {}),
        },
        include: promotionInclude,
      });
      return mapPromotion(row);
    });
  }
  public async listCoupons() {
    const rows = await this.prisma.coupon.findMany({
      include: couponInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapCoupon);
  }
  public async findCoupon(code: string) {
    const row = await this.prisma.coupon.findUnique({
      where: { code },
      include: couponInclude,
    });
    return row ? mapCoupon(row) : null;
  }
  public async createCoupon(input: CouponInput) {
    try {
      return mapCoupon(
        await this.prisma.coupon.create({
          data: input,
          include: couponInclude,
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new PromotionValidationError('El código del cupón ya existe.');
      throw error;
    }
  }
  public async updateCoupon(id: string, input: Partial<CouponInput>) {
    try {
      return mapCoupon(
        await this.prisma.coupon.update({
          where: { id },
          data: input,
          include: couponInclude,
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new PromotionNotFoundError('El cupón no existe.');
      throw error;
    }
  }
}

const promotionData = (input: Partial<PromotionInput>) => ({
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(input.type !== undefined ? { type: input.type } : {}),
  ...(input.kind !== undefined ? { kind: input.kind } : {}),
  ...(input.value !== undefined ? { value: input.value } : {}),
  ...(input.active !== undefined ? { active: input.active } : {}),
  ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
  ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
  ...(input.priority !== undefined ? { priority: input.priority } : {}),
  ...(input.minimumSubtotal !== undefined
    ? { minimumSubtotal: input.minimumSubtotal }
    : {}),
  ...(input.maxRedemptions !== undefined
    ? { maxRedemptions: input.maxRedemptions }
    : {}),
});

const mapPromotion = (value: PromotionRecord): Promotion => ({
  id: value.id,
  name: value.name,
  type: value.type,
  kind: value.kind ?? 'DISCOUNT',
  value: value.value.toString(),
  active: value.active,
  startsAt: value.startsAt,
  endsAt: value.endsAt,
  priority: value.priority,
  minimumSubtotal: value.minimumSubtotal?.toString() ?? null,
  maxRedemptions: value.maxRedemptions,
  redemptionCount: value.redemptionCount,
  targets: value.targets.map((target) => ({
    productId: target.productId,
    variantId: target.variantId,
    categoryId: target.categoryId,
    brandId: target.brandId,
  })),
  bundleItems: value.bundleItems.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  })),
});
const mapCoupon = (value: CouponRecord): Coupon => ({
  id: value.id,
  promotionId: value.promotionId,
  code: value.code,
  active: value.active,
  startsAt: value.startsAt,
  endsAt: value.endsAt,
  maxRedemptions: value.maxRedemptions,
  redemptionCount: value.redemptionCount,
  perCustomerLimit: value.perCustomerLimit,
  promotion: mapPromotion(value.promotion),
});
