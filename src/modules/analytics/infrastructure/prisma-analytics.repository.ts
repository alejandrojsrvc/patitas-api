import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { AnalyticsRepository } from '../domain/analytics.repository';
import type { ProductViewStats } from '../domain/analytics.types';
import type { RecentlyViewedProduct } from '../domain/analytics.types';
import { CatalogNotFoundError } from '../../catalog/domain/errors/catalog.error';

@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async recordProductView(
    slug: string,
    viewerKey: string,
    customerId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { slug, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!product) throw new CatalogNotFoundError('El producto');
      const day = startOfDay(new Date());
      await transaction.productViewDaily.upsert({
        where: { productId_viewDate: { productId: product.id, viewDate: day } },
        create: {
          productId: product.id,
          viewDate: day,
          totalViews: 1,
          uniqueViews: 0,
        },
        update: { totalViews: { increment: 1 } },
      });
      const visitorInsert =
        await transaction.productViewVisitorDaily.createMany({
          data: {
            productId: product.id,
            viewDate: day,
            visitorHash: viewerKey,
            lastViewedAt: new Date(),
          },
          skipDuplicates: true,
        });
      const unique = visitorInsert.count > 0;
      if (!unique) {
        await transaction.productViewVisitorDaily.update({
          where: {
            productId_viewDate_visitorHash: {
              productId: product.id,
              viewDate: day,
              visitorHash: viewerKey,
            },
          },
          data: { lastViewedAt: new Date() },
        });
      }
      if (unique)
        await transaction.productViewDaily.update({
          where: {
            productId_viewDate: { productId: product.id, viewDate: day },
          },
          data: { uniqueViews: { increment: 1 } },
        });
      await transaction.recentProductView.upsert({
        where: { viewerKey_productId: { viewerKey, productId: product.id } },
        create: {
          viewerKey,
          productId: product.id,
          customerId: customerId ?? null,
        },
        update: { customerId: customerId ?? null, lastViewedAt: new Date() },
      });
    });
  }

  public async listRecentlyViewed(
    viewerKey: string,
    limit: number,
  ): Promise<RecentlyViewedProduct[]> {
    const rows = await this.prisma.recentProductView.findMany({
      where: { viewerKey },
      orderBy: { lastViewedAt: 'desc' },
      take: limit,
      include: {
        product: {
          include: {
            brand: true,
            category: true,
            variants: {
              include: { inventory: true, preferredSupplierOffer: true },
            },
            media: { orderBy: { displayOrder: 'asc' } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      description: row.product.description,
      brand: {
        id: row.product.brand.id,
        name: row.product.brand.name,
        slug: row.product.brand.slug,
      },
      category: row.product.category
        ? {
            id: row.product.category.id,
            name: row.product.category.name,
            slug: row.product.category.slug,
          }
        : null,
      imageUrl: row.product.media?.[0]?.url ?? null,
      viewedAt: row.lastViewedAt,
      variants: row.product.variants.flatMap((variant) => {
        if (!variant.active || variant.salePrice === null) return [];
        return [
          {
            id: variant.id,
            presentation: variant.presentation,
            salePrice: variant.salePrice.toString(),
            availableQuantity: Math.max(
              0,
              (variant.inventory?.onHand ?? 0) -
                (variant.inventory?.reserved ?? 0),
            ),
          },
        ];
      }),
    }));
  }

  public async getProductStats(
    productId: string,
    from: Date,
    to: Date,
  ): Promise<ProductViewStats> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new CatalogNotFoundError('El producto');
    const rows = await this.prisma.productViewDaily.findMany({
      where: {
        productId,
        viewDate: { gte: startOfDay(from), lte: startOfDay(to) },
      },
      orderBy: { viewDate: 'asc' },
    });
    return {
      productId,
      from: from.toISOString(),
      to: to.toISOString(),
      totalViews: rows.reduce((sum, row) => sum + row.totalViews, 0),
      uniqueViews: rows.reduce((sum, row) => sum + row.uniqueViews, 0),
      daily: rows.map((row) => ({
        date: row.viewDate.toISOString().slice(0, 10),
        totalViews: row.totalViews,
        uniqueViews: row.uniqueViews,
      })),
    };
  }
}

const startOfDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
