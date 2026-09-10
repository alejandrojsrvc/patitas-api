import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  catalogCacheKeys,
  type CatalogCacheInvalidation,
  type CatalogCacheInvalidationPort,
} from '../../shared/application/ports/catalog-cache-invalidation.port';

const INITIAL_FLUSH_DELAY_MS = 500;
const MINIMUM_FLUSH_INTERVAL_MS = 12_000;
const MAX_KEYS_PER_PURGE = 100;

@Injectable()
export class HttpCatalogCacheInvalidationAdapter implements CatalogCacheInvalidationPort {
  private readonly logger = new Logger(HttpCatalogCacheInvalidationAdapter.name);
  private readonly enabled: boolean;
  private readonly varnishUrl?: string;
  private readonly varnishToken?: string;
  private readonly cloudflareZoneId?: string;
  private readonly cloudflareToken?: string;
  private readonly pendingKeys = new Set<string>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  private lastFlushAt = 0;

  public constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('CATALOG_EDGE_CACHE_ENABLED') === true;
    this.varnishUrl = readOptional(config, 'VARNISH_PURGE_URL');
    this.varnishToken = readOptional(config, 'VARNISH_PURGE_SECRET');
    this.cloudflareZoneId = readOptional(config, 'CLOUDFLARE_ZONE_ID');
    this.cloudflareToken = readOptional(config, 'CLOUDFLARE_CACHE_PURGE_TOKEN');
  }

  public invalidate(input: CatalogCacheInvalidation | readonly CatalogCacheInvalidation[]): Promise<void> {
    if (!this.enabled) return Promise.resolve();

    for (const key of catalogCacheKeys(input)) this.pendingKeys.add(key);
    if (this.pendingKeys.has('catalog') || this.pendingKeys.size > MAX_KEYS_PER_PURGE) {
      this.pendingKeys.clear();
      this.pendingKeys.add('catalog');
    }
    this.scheduleFlush();
    return Promise.resolve();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    const elapsed = Date.now() - this.lastFlushAt;
    const delay = Math.max(INITIAL_FLUSH_DELAY_MS, MINIMUM_FLUSH_INTERVAL_MS - elapsed);
    this.flushTimer = setTimeout(() => void this.flush(), delay);
    this.flushTimer.unref();
  }

  private async flush(): Promise<void> {
    this.flushTimer = undefined;
    if (!this.pendingKeys.size) return;

    const keys = [...this.pendingKeys].sort();
    this.pendingKeys.clear();
    this.lastFlushAt = Date.now();

    try {
      await this.purgeVarnish(keys);
    } catch (error) {
      this.warn('varnish', keys, error);
      if (this.pendingKeys.size) this.scheduleFlush();
      return;
    }

    try {
      await this.purgeCloudflare(keys);
    } catch (error) {
      this.warn('cloudflare', keys, error);
    } finally {
      if (this.pendingKeys.size) this.scheduleFlush();
    }
  }

  private async purgeVarnish(keys: string[]): Promise<void> {
    if (!this.varnishUrl || !this.varnishToken) throw new Error('Varnish purge no está configurado.');
    const response = await fetch(this.varnishUrl, {
      method: 'PURGE',
      headers: {
        Accept: 'application/json',
        'X-Patitas-XKey': keys.join(' '),
        'X-Purge-Token': this.varnishToken,
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`Varnish respondió ${response.status}.`);
  }

  private async purgeCloudflare(keys: string[]): Promise<void> {
    if (!this.cloudflareZoneId || !this.cloudflareToken) return;
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.cloudflareZoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cloudflareToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: keys }),
      signal: AbortSignal.timeout(5_000),
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
    if (!response.ok || body?.success !== true) throw new Error(`Cloudflare respondió ${response.status}.`);
  }

  private warn(layer: 'varnish' | 'cloudflare', keys: string[], error: unknown): void {
    this.logger.warn(
      JSON.stringify({
        event: 'catalog_cache_invalidation_failed',
        layer,
        keys,
        message: error instanceof Error ? error.message : 'Error desconocido.',
      }),
    );
  }
}

const readOptional = (config: ConfigService, key: string): string | undefined => config.get<string>(key)?.trim() || undefined;
