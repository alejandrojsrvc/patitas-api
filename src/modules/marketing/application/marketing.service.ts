import type { MarketingProvider } from '../../../shared/application/ports/marketing-provider.interface';
import type {
  MarketingEventPersistenceInput,
  MarketingEventRepository,
} from '../domain/marketing.repository';

export class MarketingService {
  public constructor(
    private readonly repository: MarketingEventRepository,
    private readonly provider: MarketingProvider,
  ) {}
  public async record(input: MarketingEventPersistenceInput) {
    const event = await this.repository.create(input);
    if (event.duplicate) return { accepted: true, duplicate: true };
    try {
      await this.provider.send(input);
      await this.repository.markSent(event.id);
      return { accepted: true, duplicate: false };
    } catch (error) {
      await this.repository.markFailed(
        event.id,
        error instanceof Error ? error.message : 'Proveedor no disponible',
      );
      return { accepted: false, duplicate: false };
    }
  }
}
