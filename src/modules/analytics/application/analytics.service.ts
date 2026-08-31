import { CatalogNotFoundError } from '../../catalog/domain/errors/catalog.error';
import type { AnalyticsRepository } from '../domain/analytics.repository';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';
import type { RecentlyViewedProduct } from '../domain/analytics.types';

export class AnalyticsService {
  public constructor(
    private readonly repository: AnalyticsRepository,
    private readonly storage?: StorageProvider,
  ) {}
  public recordProductView(
    slug: string,
    viewerKey: string,
    customerId?: string,
  ) {
    if (!viewerKey.trim()) throw new CatalogNotFoundError('El visitante');
    return this.repository.recordProductView(slug, viewerKey, customerId);
  }
  public async recentlyViewed(viewerKey: string, limit = 20) {
    const items = await this.repository.listRecentlyViewed(
      viewerKey,
      Math.min(20, Math.max(1, limit)),
    );
    const storage = this.storage;
    if (!storage) return items;
    return items.map((item: RecentlyViewedProduct) => ({
      ...item,
      imageUrl:
        item.imageUrl && !/^https?:\/\//i.test(item.imageUrl)
          ? storage.getPublicUrl({
              bucket: 'product-media',
              path: item.imageUrl,
            })
          : item.imageUrl,
    }));
  }
  public productStats(productId: string, from?: string, to?: string) {
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    const start = from
      ? new Date(`${from}T00:00:00.000Z`)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    )
      throw new CatalogNotFoundError('El rango de fechas');
    return this.repository.getProductStats(productId, start, end);
  }
}
