import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MarketingEventInput, MarketingProvider } from '../../shared/application/ports/marketing-provider.interface';
@Injectable()
export class HttpMarketingAdapter implements MarketingProvider {
  private readonly url?: string; private readonly token?: string;
  public constructor(config: ConfigService) { this.url = config.get<string>('MARKETING_PROVIDER_URL')?.trim() || undefined; this.token = config.get<string>('MARKETING_PROVIDER_TOKEN')?.trim() || undefined; }
  public async send(input: MarketingEventInput) { if (!this.url) throw new Error('MARKETING_PROVIDER_URL no está configurado.'); const response = await fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(input) }); if (!response.ok) throw new Error('El proveedor de marketing rechazó el evento.'); }
}
