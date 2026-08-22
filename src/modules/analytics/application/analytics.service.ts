import { CatalogNotFoundError } from '../../catalog/domain/errors/catalog.error';
import type { AnalyticsRepository } from '../domain/analytics.repository';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';

export class AnalyticsService {
  public constructor(private readonly repository: AnalyticsRepository, private readonly storage?: StorageProvider) {}
  public recordProductView(slug: string, viewerKey: string, customerId?: string) {
    if (!viewerKey.trim()) throw new CatalogNotFoundError('El visitante');
    return this.repository.recordProductView(slug, viewerKey, customerId);
  }
  public async recentlyViewed(viewerKey: string, limit = 20) {
    const items = await this.repository.listRecentlyViewed(viewerKey, Math.min(20, Math.max(1, limit)));
    if (!this.storage) return items;
    return Promise.all(items.map(async (item: any) => ({ ...item, imageUrl: item.imageUrl && !/^https?:\/\//i.test(item.imageUrl) ? await this.storage!.getSignedUrl({ bucket: 'product-media', path: item.imageUrl }, 3_600) : item.imageUrl })));
  }
  public productStats(productId: string, from?: string, to?: string) {
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new CatalogNotFoundError('El rango de fechas');
    return this.repository.getProductStats(productId, start, end);
  }
}
