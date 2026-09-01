import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CatalogCacheInvalidation,
  CatalogCacheInvalidationPort,
} from '../../shared/application/ports/catalog-cache-invalidation.port';

@Injectable()
export class HttpCatalogCacheInvalidationAdapter implements CatalogCacheInvalidationPort {
  private readonly endpoint?: string;
  private readonly token?: string;

  public constructor(config: ConfigService) {
    const webUrl = config.get<string>('PUBLIC_WEB_URL')?.trim();
    this.endpoint = webUrl
      ? new URL('/api/internal/cache/catalog', webUrl).toString()
      : undefined;
    this.token =
      config.get<string>('CATALOG_CACHE_INVALIDATION_SECRET')?.trim() ||
      undefined;
  }

  public async invalidate(input: CatalogCacheInvalidation): Promise<void> {
    if (!this.endpoint || !this.token) return;
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-catalog-cache-token': this.token,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      throw new Error('La invalidación de caché del catálogo fue rechazada.');
  }
}
